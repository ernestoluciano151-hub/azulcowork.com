/**
 * erp-email-service.ts — Templates de email financeiros (Volume 02 — Sprint ERP-8)
 *
 * 4 templates:
 *   sendInvoiceEmail     — fatura emitida (ISSUED → SENT)
 *   sendReceiptEmail     — confirmação de pagamento + recibo
 *   sendReminderEmail    — lembrete de vencimento (N dias antes)
 *   sendOverdueEmail     — fatura vencida (urgente)
 *
 * Transporte: nodemailer SMTP
 * Env vars obrigatórias: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Env vars opcionais:   SMTP_SECURE (default false), SMTP_FROM
 *
 * Graceful degradation: se SMTP não estiver configurado, regista aviso e retorna.
 *
 * Docs: docs/05-erp/communication.md
 */

import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

async function logErpEmail(opts: {
  templateSlug: string;
  to: string;
  subject: string;
  body: string;
  channel: string;
  entityType?: string;
  entityId?: string;
  success: boolean;
  errorMsg?: string;
}) {
  try {
    await prisma.communicationLog.create({
      data: {
        type:         "EMAIL",
        channel:      opts.channel,
        templateSlug: opts.templateSlug,
        to:           opts.to,
        subject:      opts.subject,
        body:         opts.body,
        status:       opts.success ? "SENT" : "FAILED",
        attempts:     1,
        lastAttemptAt: new Date(),
        sentAt:       opts.success ? new Date() : null,
        errorMsg:     opts.errorMsg ?? null,
        entityType:   opts.entityType ?? null,
        entityId:     opts.entityId   ?? null,
        triggeredBy:  "SYSTEM",
      },
    });
  } catch (logErr) {
    console.error("[erp-email] Falha ao registar CommunicationLog:", logErr);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtKz(v: number): string {
  return `Kz ${v.toLocaleString("pt-PT", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const dd  = String(dt.getDate()).padStart(2, "0");
  const mm  = String(dt.getMonth() + 1).padStart(2, "0");
  const yy  = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || "smtp.gmail.com",
    port:   parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

const FROM = process.env.SMTP_FROM || "Azul Coworking <geral@azulcowork.com>";

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Transferência Bancária",
  CASH:          "Numerário",
  MULTICAIXA:    "Multicaixa Express",
  POS:           "Terminal POS",
  CHECK:         "Cheque",
  OTHER:         "Outro",
};

// ── Template base HTML ────────────────────────────────────────────────────────

export function buildBaseHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1e4d91;padding:24px 32px;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;letter-spacing:1px;">AZUL COWORKING</p>
            <p style="margin:4px 0 0;color:#b3c8f0;font-size:12px;">Bairro Azul, Edifício 18 · Luanda, Angola</p>
          </td>
        </tr>
        <!-- Corpo -->
        <tr>
          <td style="padding:32px;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
            <p style="color:#999;font-size:11px;margin:0;text-align:center;line-height:1.6;">
              VERSÃO DE NEGÓCIOS · COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA<br>
              NIF: 5002174308 &nbsp;·&nbsp; <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a>
              &nbsp;·&nbsp; +244 976 467 124<br>
              <a href="https://www.azulcowork.com" style="color:#1e4d91;">www.azulcowork.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface InvoiceEmailData {
  to:            string;
  companyName:   string;
  invoiceNumber: string;
  issueDate:     Date | string;
  dueDate:       Date | string;
  total:         number;
  pdfUrl?:       string;
}

export interface ReceiptEmailData {
  to:             string;
  companyName:    string;
  receiptNumber:  string;
  invoiceNumber?: string;
  amount:         number;
  paidAt:         Date | string;
  method:         string;
  pdfUrl?:        string;
}

export interface ReminderEmailData {
  to:            string;
  companyName:   string;
  invoiceNumber: string;
  dueDate:       Date | string;
  total:         number;
  daysLeft:      number;
}

export interface OverdueEmailData {
  to:            string;
  companyName:   string;
  invoiceNumber: string;
  dueDate:       Date | string;
  total:         number;
  daysOverdue:   number;
}

// ── buildInvoiceHtml ──────────────────────────────────────────────────────────

/** Gera o corpo HTML da fatura emitida (sem enviar). Exportado para testes. */
export function buildInvoiceHtml(data: InvoiceEmailData): string {
  const pdfBtn = data.pdfUrl
    ? `<p style="margin:20px 0 0;">
         <a href="${data.pdfUrl}"
            style="background:#1e4d91;color:#fff;padding:10px 22px;
                   text-decoration:none;border-radius:4px;display:inline-block;font-size:13px;">
           ⬇ Download Factura PDF
         </a>
       </p>`
    : "";

  return `
    <h2 style="color:#1e4d91;margin:0 0 16px;">Factura Emitida</h2>
    <p>Estimado(a) <strong>${data.companyName}</strong>,</p>
    <p style="color:#444;">Enviamos em anexo a sua factura referente ao período de serviços.</p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <tr style="background:#f0f4ff;">
        <td style="padding:9px 12px;color:#666;">N.º Factura</td>
        <td style="padding:9px 12px;font-weight:bold;">${data.invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding:9px 12px;color:#666;">Data de Emissão</td>
        <td style="padding:9px 12px;">${fmtDate(data.issueDate)}</td>
      </tr>
      <tr style="background:#f0f4ff;">
        <td style="padding:9px 12px;color:#666;">Data de Vencimento</td>
        <td style="padding:9px 12px;color:#cc4400;font-weight:bold;">${fmtDate(data.dueDate)}</td>
      </tr>
      <tr>
        <td style="padding:9px 12px;color:#666;">Total (incl. IVA 14%)</td>
        <td style="padding:9px 12px;font-weight:bold;font-size:16px;color:#1e4d91;">${fmtKz(data.total)}</td>
      </tr>
    </table>

    <div style="background:#f0f4ff;padding:14px 16px;border-radius:6px;margin:16px 0;font-size:13px;">
      <p style="margin:0 0 8px;font-weight:bold;color:#1e4d91;">Dados para Pagamento por Transferência</p>
      <p style="margin:3px 0;">Banco: <strong>BCS</strong></p>
      <p style="margin:3px 0;">IBAN: <strong style="font-family:monospace;">AO06007000000212870210113</strong></p>
      <p style="margin:3px 0;">SWIFT: CDTSAOLU</p>
      <p style="margin:3px 0;">Referência: <strong>${data.invoiceNumber}</strong></p>
    </div>

    ${pdfBtn}

    <p style="color:#666;font-size:13px;margin-top:20px;">
      Qualquer questão, contacte-nos em
      <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a>
      ou <a href="tel:+244976467124" style="color:#1e4d91;">+244 976 467 124</a>.
    </p>
    <p style="margin-top:20px;">Cumprimentos,<br><strong>Azul Coworking</strong></p>
  `;
}

// ── buildReceiptHtml ──────────────────────────────────────────────────────────

export function buildReceiptHtml(data: ReceiptEmailData): string {
  const refRow = data.invoiceNumber
    ? `<tr style="background:#f0f4ff;">
         <td style="padding:9px 12px;color:#666;font-size:13px;">Factura</td>
         <td style="padding:9px 12px;font-size:13px;">${data.invoiceNumber}</td>
       </tr>`
    : "";
  const pdfBtn = data.pdfUrl
    ? `<p style="margin:20px 0 0;">
         <a href="${data.pdfUrl}"
            style="background:#1e4d91;color:#fff;padding:10px 22px;
                   text-decoration:none;border-radius:4px;display:inline-block;font-size:13px;">
           ⬇ Download Recibo PDF
         </a>
       </p>`
    : "";

  return `
    <h2 style="color:#1e4d91;margin:0 0 16px;">Recibo de Pagamento</h2>
    <p>Estimado(a) <strong>${data.companyName}</strong>,</p>
    <p style="color:#444;">Confirmamos a recepção do seu pagamento. Obrigado!</p>

    <div style="background:#1e4d91;color:#fff;padding:20px;border-radius:8px;
                margin:16px 0;text-align:center;">
      <p style="margin:0;font-size:12px;opacity:0.8;">VALOR RECEBIDO</p>
      <p style="margin:8px 0 0;font-size:30px;font-weight:bold;">${fmtKz(data.amount)}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <tr style="background:#f0f4ff;">
        <td style="padding:9px 12px;color:#666;">N.º Recibo</td>
        <td style="padding:9px 12px;font-weight:bold;">${data.receiptNumber}</td>
      </tr>
      ${refRow}
      <tr>
        <td style="padding:9px 12px;color:#666;">Data de Pagamento</td>
        <td style="padding:9px 12px;">${fmtDate(data.paidAt)}</td>
      </tr>
      <tr style="background:#f0f4ff;">
        <td style="padding:9px 12px;color:#666;">Forma de Pagamento</td>
        <td style="padding:9px 12px;">${METHOD_LABELS[data.method] ?? data.method}</td>
      </tr>
    </table>

    ${pdfBtn}

    <p style="color:#444;font-size:13px;margin-top:20px;">
      Azul Coworking agradece a sua confiança e preferência.
    </p>
    <p style="margin-top:20px;">Cumprimentos,<br><strong>Azul Coworking</strong></p>
  `;
}

// ── buildReminderHtml ─────────────────────────────────────────────────────────

export function buildReminderHtml(data: ReminderEmailData): string {
  const urgency = data.daysLeft <= 3 ? "urgente" : "próximo";
  return `
    <h2 style="color:#d97706;margin:0 0 16px;">⏰ Lembrete de Pagamento</h2>
    <p>Estimado(a) <strong>${data.companyName}</strong>,</p>
    <p style="color:#444;">
      Informamos que a factura <strong>${data.invoiceNumber}</strong>
      tem vencimento <strong>${urgency}</strong> em
      <strong style="color:#cc4400;">${fmtDate(data.dueDate)}</strong>.
    </p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <tr style="background:#fff8ed;">
        <td style="padding:9px 12px;color:#666;">N.º Factura</td>
        <td style="padding:9px 12px;font-weight:bold;">${data.invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding:9px 12px;color:#666;">Vencimento</td>
        <td style="padding:9px 12px;color:#cc4400;font-weight:bold;">${fmtDate(data.dueDate)}</td>
      </tr>
      <tr style="background:#fff8ed;">
        <td style="padding:9px 12px;color:#666;">Dias para Vencimento</td>
        <td style="padding:9px 12px;font-weight:bold;">${data.daysLeft} dia(s)</td>
      </tr>
      <tr>
        <td style="padding:9px 12px;color:#666;">Total</td>
        <td style="padding:9px 12px;font-weight:bold;font-size:16px;color:#1e4d91;">${fmtKz(data.total)}</td>
      </tr>
    </table>

    <div style="background:#f0f4ff;padding:14px 16px;border-radius:6px;margin:16px 0;font-size:13px;">
      <p style="margin:0 0 8px;font-weight:bold;color:#1e4d91;">Dados para Pagamento</p>
      <p style="margin:3px 0;">Banco: <strong>BCS</strong> &nbsp;·&nbsp;
         IBAN: <strong style="font-family:monospace;">AO06007000000212870210113</strong></p>
      <p style="margin:3px 0;">Referência: <strong>${data.invoiceNumber}</strong></p>
    </div>

    <p style="color:#666;font-size:13px;">
      Dúvidas? Contacte-nos em
      <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a>.
    </p>
    <p style="margin-top:20px;">Cumprimentos,<br><strong>Azul Coworking</strong></p>
  `;
}

// ── buildOverdueHtml ──────────────────────────────────────────────────────────

export function buildOverdueHtml(data: OverdueEmailData): string {
  return `
    <h2 style="color:#dc2626;margin:0 0 16px;">⚠ Factura em Atraso</h2>
    <p>Estimado(a) <strong>${data.companyName}</strong>,</p>
    <p style="color:#444;">
      A sua factura <strong>${data.invoiceNumber}</strong> encontra-se em atraso há
      <strong style="color:#dc2626;">${data.daysOverdue} dia(s)</strong>.
      Solicitamos a regularização urgente para evitar a suspensão do serviço.
    </p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0;
                  border:2px solid #dc2626;border-radius:6px;font-size:13px;">
      <tr style="background:#fef2f2;">
        <td style="padding:9px 12px;color:#666;">N.º Factura</td>
        <td style="padding:9px 12px;font-weight:bold;">${data.invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding:9px 12px;color:#666;">Vencimento</td>
        <td style="padding:9px 12px;color:#dc2626;font-weight:bold;">${fmtDate(data.dueDate)}</td>
      </tr>
      <tr style="background:#fef2f2;">
        <td style="padding:9px 12px;color:#666;">Dias em Atraso</td>
        <td style="padding:9px 12px;color:#dc2626;font-weight:bold;">${data.daysOverdue} dia(s)</td>
      </tr>
      <tr>
        <td style="padding:9px 12px;color:#666;">Total em Dívida</td>
        <td style="padding:9px 12px;font-weight:bold;font-size:16px;color:#dc2626;">${fmtKz(data.total)}</td>
      </tr>
    </table>

    <div style="background:#f0f4ff;padding:14px 16px;border-radius:6px;margin:16px 0;font-size:13px;">
      <p style="margin:0 0 8px;font-weight:bold;color:#1e4d91;">Dados para Pagamento Imediato</p>
      <p style="margin:3px 0;">Banco: <strong>BCS</strong> &nbsp;·&nbsp;
         IBAN: <strong style="font-family:monospace;">AO06007000000212870210113</strong></p>
      <p style="margin:3px 0;">Referência: <strong>${data.invoiceNumber}</strong></p>
    </div>

    <p style="color:#444;font-size:13px;">
      Contacte-nos imediatamente em
      <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a>
      ou <a href="tel:+244976467124" style="color:#1e4d91;">+244 976 467 124</a>.
    </p>
    <p style="margin-top:20px;">Cumprimentos,<br><strong>Equipa Financeira — Azul Coworking</strong></p>
  `;
}

// ── Funções de envio ──────────────────────────────────────────────────────────

/** Envia email de fatura emitida. Silencia se SMTP não configurado. */
export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<void> {
  const subject = `Factura ${data.invoiceNumber} — Azul Coworking`;
  const html = buildBaseHtml(`Factura ${data.invoiceNumber} — Azul Coworking`, buildInvoiceHtml(data));
  if (!isSmtpConfigured()) {
    console.warn("[erp-email] SMTP não configurado — email de fatura não enviado.");
    void logErpEmail({ templateSlug: "invoice-sent", to: data.to, subject, body: html, channel: "financial", entityType: "INVOICE", success: false, errorMsg: "SMTP não configurado" });
    return;
  }
  try {
    await createTransporter().sendMail({ from: FROM, to: data.to, subject, html });
    void logErpEmail({ templateSlug: "invoice-sent", to: data.to, subject, body: html, channel: "financial", entityType: "INVOICE", success: true });
  } catch (err) {
    void logErpEmail({ templateSlug: "invoice-sent", to: data.to, subject, body: html, channel: "financial", entityType: "INVOICE", success: false, errorMsg: String(err) });
    throw err;
  }
}

/** Envia email de confirmação de pagamento com link do recibo. */
export async function sendReceiptEmail(data: ReceiptEmailData): Promise<void> {
  const subject = `Recibo de Pagamento ${data.receiptNumber} — Azul Coworking`;
  const html = buildBaseHtml(`Recibo ${data.receiptNumber} — Azul Coworking`, buildReceiptHtml(data));
  if (!isSmtpConfigured()) {
    console.warn("[erp-email] SMTP não configurado — email de recibo não enviado.");
    void logErpEmail({ templateSlug: "payment-receipt", to: data.to, subject, body: html, channel: "receipt", entityType: "PAYMENT", success: false, errorMsg: "SMTP não configurado" });
    return;
  }
  try {
    await createTransporter().sendMail({ from: FROM, to: data.to, subject, html });
    void logErpEmail({ templateSlug: "payment-receipt", to: data.to, subject, body: html, channel: "receipt", entityType: "PAYMENT", success: true });
  } catch (err) {
    void logErpEmail({ templateSlug: "payment-receipt", to: data.to, subject, body: html, channel: "receipt", entityType: "PAYMENT", success: false, errorMsg: String(err) });
    throw err;
  }
}

/** Envia lembrete de vencimento (N dias antes). */
export async function sendReminderEmail(data: ReminderEmailData): Promise<void> {
  const subject = `Lembrete: Factura ${data.invoiceNumber} vence em ${data.daysLeft} dia(s) — Azul Coworking`;
  const html = buildBaseHtml(`Lembrete: Factura ${data.invoiceNumber}`, buildReminderHtml(data));
  if (!isSmtpConfigured()) {
    console.warn("[erp-email] SMTP não configurado — lembrete não enviado.");
    void logErpEmail({ templateSlug: "payment-reminder", to: data.to, subject, body: html, channel: "reminder", entityType: "INVOICE", success: false, errorMsg: "SMTP não configurado" });
    return;
  }
  try {
    await createTransporter().sendMail({ from: FROM, to: data.to, subject, html });
    void logErpEmail({ templateSlug: "payment-reminder", to: data.to, subject, body: html, channel: "reminder", entityType: "INVOICE", success: true });
  } catch (err) {
    void logErpEmail({ templateSlug: "payment-reminder", to: data.to, subject, body: html, channel: "reminder", entityType: "INVOICE", success: false, errorMsg: String(err) });
    throw err;
  }
}

/** Envia notificação de fatura vencida. */
export async function sendOverdueEmail(data: OverdueEmailData): Promise<void> {
  const subject = `⚠ URGENTE: Factura ${data.invoiceNumber} em atraso (${data.daysOverdue} dias) — Azul Coworking`;
  const html = buildBaseHtml(`Factura em Atraso ${data.invoiceNumber}`, buildOverdueHtml(data));
  if (!isSmtpConfigured()) {
    console.warn("[erp-email] SMTP não configurado — email de atraso não enviado.");
    void logErpEmail({ templateSlug: "payment-overdue", to: data.to, subject, body: html, channel: "alert", entityType: "INVOICE", success: false, errorMsg: "SMTP não configurado" });
    return;
  }
  try {
    await createTransporter().sendMail({ from: FROM, to: data.to, subject, html });
    void logErpEmail({ templateSlug: "payment-overdue", to: data.to, subject, body: html, channel: "alert", entityType: "INVOICE", success: true });
  } catch (err) {
    void logErpEmail({ templateSlug: "payment-overdue", to: data.to, subject, body: html, channel: "alert", entityType: "INVOICE", success: false, errorMsg: String(err) });
    throw err;
  }
}
