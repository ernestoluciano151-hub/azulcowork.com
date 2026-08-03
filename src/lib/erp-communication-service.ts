/**
 * erp-communication-service.ts — Orquestrador de comunicação financeira (Volume 02 — Sprint ERP-8)
 *
 * Operações:
 *   sendInvoice(invoiceId, actorId)
 *     1. Validar: invoice existe + status = ISSUED
 *     2. Gerar PDF via erp-pdf-service
 *     3. Upload Cloudinary → /invoices/YYYY/MM/<invoiceNumber>.pdf
 *     4. Actualizar invoice: pdfUrl, status = SENT, sentAt, sentTo (company.email)
 *     5. Enviar email via erp-email-service
 *     6. Publicar erp.invoice.sent
 *
 *   sendReceipt(paymentId)
 *     1. Fetch payment + invoice + company
 *     2. Gerar PDF recibo
 *     3. Upload Cloudinary → /receipts/YYYY/MM/<receiptNumber>.pdf
 *     4. Actualizar payment: receiptUrl
 *     5. Enviar email de recibo
 *
 *   sendPaymentReminder(invoiceId)   — lembrete manual
 *   sendOverdueNotice(invoiceId)     — notificação de atraso manual
 *
 * Graceful degradation:
 *   - Cloudinary não configurado → PDF gerado mas não uploaded (pdfUrl = null)
 *   - SMTP não configurado → PDF gerado e uploaded mas email não enviado
 *   - Ambos não configurados → operação regista warning e retorna resultado parcial
 *
 * Docs: docs/05-erp/communication.md
 */

import { prisma }                     from "@/lib/prisma";
import { publish }                    from "@/lib/event-bus";
import { generateInvoicePdf, generateReceiptPdf } from "@/lib/erp-pdf-service";
import {
  sendInvoiceEmail,
  sendReceiptEmail,
  sendReminderEmail,
  sendOverdueEmail,
} from "@/lib/erp-email-service";
import { ErpInvoiceStatus }           from "@prisma/client";
import { v2 as cloudinary }           from "cloudinary";
import { differenceInDays }           from "date-fns";

// ── Cloudinary config ─────────────────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

// ── Upload helper ─────────────────────────────────────────────────────────────

async function uploadPdfToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId: string
): Promise<string> {
  const b64     = buffer.toString("base64");
  const dataUri = `data:application/pdf;base64,${b64}`;
  const result  = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "raw",
    public_id:     publicId,
    use_filename:  false,
    unique_filename: false,
    overwrite:     true,
  });
  return result.secure_url;
}

function cloudinaryFolder(type: "invoices" | "receipts", date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, "0");
  return `azul-cowork/erp/${type}/${yyyy}/${mm}`;
}

// ── Resultado da operação ─────────────────────────────────────────────────────

export interface CommunicationResult {
  pdfGenerated: boolean;
  pdfUrl:       string | null;
  emailSent:    boolean;
  warnings:     string[];
}

// ── sendInvoice ───────────────────────────────────────────────────────────────

/**
 * Envia factura por email (ISSUED → SENT).
 * Gera PDF, faz upload ao Cloudinary, actualiza BD, envia email.
 */
export async function sendInvoice(
  invoiceId: string,
  actorId:   string
): Promise<CommunicationResult> {
  const result: CommunicationResult = {
    pdfGenerated: false,
    pdfUrl:       null,
    emailSent:    false,
    warnings:     [],
  };

  // 1. Fetch invoice
  const invoice = await prisma.erpInvoice.findUniqueOrThrow({
    where:   { id: invoiceId },
    include: {
      items:   true,
      company: true,
    },
  });

  if (invoice.status !== ErpInvoiceStatus.ISSUED) {
    throw new Error(
      `Apenas facturas com status ISSUED podem ser enviadas. Status actual: ${invoice.status}`
    );
  }

  const sentTo = invoice.company?.email;
  if (!sentTo) {
    throw new Error("Empresa sem email configurado — impossível enviar factura.");
  }

  // 2. Gerar PDF
  const pdfData = {
    number:    invoice.number,
    issueDate: invoice.issueDate,
    dueDate:   invoice.dueDate,
    subtotal:  invoice.subtotal,
    taxRate:   invoice.taxRate,
    taxAmount: invoice.taxAmount,
    total:     invoice.total,
    notes:     invoice.notes ?? undefined,
    items:     invoice.items.map((it) => ({
      description: it.description,
      quantity:    it.quantity,
      unitPrice:   it.unitPrice,
      total:       it.total,
    })),
    company: invoice.company
      ? {
          name:        invoice.company.name,
          nif:         invoice.company.nif ?? undefined,
          email:       invoice.company.email,
          responsible: invoice.company.responsible,
        }
      : undefined,
  };

  const pdfBuffer = await generateInvoicePdf(pdfData);
  result.pdfGenerated = true;

  // 3. Upload Cloudinary
  let pdfUrl: string | null = null;
  if (isCloudinaryConfigured()) {
    try {
      const folder   = cloudinaryFolder("invoices", invoice.issueDate);
      const publicId = invoice.number.replace(/\//g, "-");
      pdfUrl = await uploadPdfToCloudinary(pdfBuffer, folder, publicId);
      result.pdfUrl = pdfUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.warnings.push(`Cloudinary upload falhou: ${msg}`);
      console.warn("[erp-comm] Cloudinary upload falhou:", msg);
    }
  } else {
    result.warnings.push("Cloudinary não configurado — PDF não armazenado.");
  }

  // 4. Actualizar invoice → SENT
  await prisma.erpInvoice.update({
    where: { id: invoiceId },
    data: {
      status:    ErpInvoiceStatus.SENT,
      sentAt:    new Date(),
      sentTo,
      ...(pdfUrl ? { pdfUrl } : {}),
    },
  });

  // 5. Enviar email
  try {
    await sendInvoiceEmail({
      to:            sentTo,
      companyName:   invoice.company!.name,
      invoiceNumber: invoice.number,
      issueDate:     invoice.issueDate,
      dueDate:       invoice.dueDate,
      total:         invoice.total,
      pdfUrl:        pdfUrl ?? undefined,
    });
    result.emailSent = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.warnings.push(`Email não enviado: ${msg}`);
    console.warn("[erp-comm] Email invoice falhou:", msg);
  }

  // 6. Evento
  publish("erp.invoice.sent", {
    invoiceId:     invoiceId,
    invoiceNumber: invoice.number,
    sentTo,
    companyId:     invoice.companyId ?? undefined,
    timestamp:     new Date().toISOString(),
  }).catch(() => {});

  return result;
}

// ── sendReceipt ───────────────────────────────────────────────────────────────

/**
 * Gera recibo em PDF (e, por defeito, envia por email).
 * Actualiza ErpPayment.receiptUrl.
 *
 * opts.skipEmail — quando true, gera e guarda o PDF mas não tenta enviar
 * email nem exige que a empresa tenha email configurado. Usado quando o
 * admin prefere rever/enviar manualmente (ex: recibo da Taxa de Condomínio).
 */
export async function sendReceipt(
  paymentId: string,
  opts: { skipEmail?: boolean } = {}
): Promise<CommunicationResult> {
  const result: CommunicationResult = {
    pdfGenerated: false,
    pdfUrl:       null,
    emailSent:    false,
    warnings:     [],
  };

  // 1. Fetch payment
  const payment = await prisma.erpPayment.findUniqueOrThrow({
    where:   { id: paymentId },
    include: {
      invoice: true,
      company: true,
    },
  });

  const sentTo = payment.company?.email ?? payment.invoice?.sentTo;
  if (!opts.skipEmail && !sentTo) {
    throw new Error("Pagamento sem email configurado — impossível enviar recibo.");
  }

  if (!payment.receiptNumber) {
    throw new Error("Pagamento sem número de recibo — confirm o pagamento primeiro.");
  }

  // 2. Gerar PDF
  const receiptData = {
    receiptNumber:  payment.receiptNumber,
    invoiceNumber:  payment.invoice?.number,
    amount:         payment.amount,
    method:         payment.method,
    paidAt:         payment.paidAt,
    reference:      payment.reference ?? undefined,
    notes:          payment.notes    ?? undefined,
    company: payment.company
      ? { name: payment.company.name, email: payment.company.email }
      : undefined,
  };

  const pdfBuffer = await generateReceiptPdf(receiptData);
  result.pdfGenerated = true;

  // 3. Upload Cloudinary
  let pdfUrl: string | null = null;
  if (isCloudinaryConfigured()) {
    try {
      const folder   = cloudinaryFolder("receipts", payment.paidAt);
      const publicId = payment.receiptNumber.replace(/\//g, "-");
      pdfUrl = await uploadPdfToCloudinary(pdfBuffer, folder, publicId);
      result.pdfUrl = pdfUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.warnings.push(`Cloudinary upload falhou: ${msg}`);
    }
  } else {
    result.warnings.push("Cloudinary não configurado — PDF não armazenado.");
  }

  // 4. Actualizar payment.receiptUrl
  if (pdfUrl) {
    await prisma.erpPayment.update({
      where: { id: paymentId },
      data:  { receiptUrl: pdfUrl },
    });
  }

  // 5. Enviar email (a menos que skipEmail tenha sido pedido)
  if (!opts.skipEmail && sentTo) {
    try {
      await sendReceiptEmail({
        to:             sentTo,
        companyName:    payment.company?.name ?? "Cliente",
        receiptNumber:  payment.receiptNumber,
        invoiceNumber:  payment.invoice?.number,
        amount:         payment.amount,
        paidAt:         payment.paidAt,
        method:         payment.method,
        pdfUrl:         pdfUrl ?? undefined,
      });
      result.emailSent = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.warnings.push(`Email não enviado: ${msg}`);
    }
  }

  return result;
}

// ── sendPaymentReminder ───────────────────────────────────────────────────────

/**
 * Envia lembrete de pagamento manualmente.
 * A invoice deve estar em ISSUED ou SENT (não paga).
 */
export async function sendPaymentReminder(invoiceId: string): Promise<void> {
  const invoice = await prisma.erpInvoice.findUniqueOrThrow({
    where:   { id: invoiceId },
    include: { company: true },
  });

  const validStatuses = [
    ErpInvoiceStatus.ISSUED,
    ErpInvoiceStatus.SENT,
    ErpInvoiceStatus.OVERDUE,
  ] as const;

  if (!validStatuses.includes(invoice.status as typeof validStatuses[number])) {
    throw new Error(`Lembrete apenas para invoices ISSUED | SENT | OVERDUE. Status: ${invoice.status}`);
  }

  const to = invoice.company?.email ?? invoice.sentTo;
  if (!to) throw new Error("Sem email destinatário para enviar lembrete.");

  const daysLeft = differenceInDays(new Date(invoice.dueDate), new Date());

  await sendReminderEmail({
    to,
    companyName:   invoice.company?.name ?? "Cliente",
    invoiceNumber: invoice.number,
    dueDate:       invoice.dueDate,
    total:         invoice.total,
    daysLeft:      Math.max(0, daysLeft),
  });
}

// ── sendOverdueNotice ─────────────────────────────────────────────────────────

/**
 * Envia notificação de atraso manualmente.
 */
export async function sendOverdueNotice(invoiceId: string): Promise<void> {
  const invoice = await prisma.erpInvoice.findUniqueOrThrow({
    where:   { id: invoiceId },
    include: { company: true },
  });

  const to = invoice.company?.email ?? invoice.sentTo;
  if (!to) throw new Error("Sem email destinatário.");

  const daysOverdue = Math.max(0, differenceInDays(new Date(), new Date(invoice.dueDate)));

  await sendOverdueEmail({
    to,
    companyName:   invoice.company?.name ?? "Cliente",
    invoiceNumber: invoice.number,
    dueDate:       invoice.dueDate,
    total:         invoice.total,
    daysOverdue,
  });
}
