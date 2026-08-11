export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type ReceiptData } from "@/lib/receipt-pdf";
import { renderPdfInWorker } from "@/lib/pdf-worker-client";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import path from "path";
import fs from "fs";
import * as Sentry from "@sentry/nextjs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error: authError } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO, AdminRole.COMERCIAL);
    if (authError) return authError;

    // ── fatura + empresa ─────────────────────────────────────────────────
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        company: true,
        invoicePayments: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 });
    }

    // ── reserva de sala (se aplicável) ──────────────────────────────────
    let reservation: {
      eventName: string | null;
      responsible: string | null;
      startDatetime: Date;
      plan: { name: string } | null;
    } | null = null;

    if (invoice.reservationId) {
      reservation = await prisma.reservation.findUnique({
        where: { id: invoice.reservationId },
        select: {
          eventName: true,
          responsible: true,
          startDatetime: true,
          plan: { select: { name: true } },
        },
      });
    }

    // ── logo ─────────────────────────────────────────────────────────────
    const logoPath = path.join(process.cwd(), "public", "assets", "logo-recibo.jpg");
    let logoBase64 = "";
    if (fs.existsSync(logoPath)) {
      const raw = fs.readFileSync(logoPath);
      logoBase64 = `data:image/jpeg;base64,${raw.toString("base64")}`;
    }

    const fmt = (d: Date) => format(d, "dd/MM/yyyy", { locale: pt });

    // ── nome do cliente (empresa ou responsável da reserva) ──────────────
    const co = invoice.company;
    const clientName = co?.name
      ?? reservation?.eventName
      ?? "Cliente";
    const clientNif = co?.nif ?? null;
    const clientEmail = co?.email ?? "";

    // ── número do recibo (derivado do número da fatura) ──────────────────
    const refNum = invoice.invoiceNumber.replace("FT-", "");
    const receiptNumber = `REC-${refNum}`;

    // ── data de pagamento (última parcela paga ou data de emissão) ────────
    const lastPayment = invoice.invoicePayments.filter(p => p.paidDate).slice(-1)[0];
    const paymentDate = lastPayment?.paidDate
      ? fmt(new Date(lastPayment.paidDate))
      : fmt(new Date(invoice.issueDate));

    // ── método de pagamento ──────────────────────────────────────────────
    const paymentMethod = lastPayment?.paymentMethod
      ?? invoice.paymentMethod
      ?? "Transferência Bancária";

    // ── ref. operação ────────────────────────────────────────────────────
    const operationRef = lastPayment?.operationRef ?? undefined;

    // ── valor pago (amountPaid da fatura, ou totalAmount se liquidada) ───
    const amountPaid = invoice.amountPaid > 0
      ? invoice.amountPaid
      : (invoice.status === "LIQUIDADA" ? (invoice.totalAmount || invoice.amount) : invoice.amount);

    // ── descrição ────────────────────────────────────────────────────────
    let description: string;
    if (reservation) {
      const planName = reservation.plan?.name ?? "Sala de Reunião";
      const eventLabel = reservation.eventName ?? "Evento";
      description = `${planName} — ${eventLabel} (${fmt(reservation.startDatetime)})`;
    } else {
      description = invoice.serviceType
        ?? (co ? `Serviços de Coworking — ${co.planType || "Plano"} (${co.roomNumber || ""})` : "Serviços de Coworking");
    }

    // ── montar dados ─────────────────────────────────────────────────────
    const rec: ReceiptData = {
      receiptNumber,
      paymentDate,
      paymentMethod,
      operationRef,
      amount:      amountPaid,
      invoiceRef:  invoice.invoiceNumber,
      description,
      clientName,
      clientNif,
      clientEmail,
      logoBase64,
    };

    // ── gerar PDF ─────────────────────────────────────────────────────────
    // 05 Ago 2026: geração corre num processo Node isolado, fora do bundler
    // do Next.js — ver src/lib/pdf-worker-client.ts.
    const pdfBuffer = await renderPdfInWorker("receipt-download", rec);

    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
    const filename  = `Recibo_${refNum}_${safeName}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });

  } catch (err) {
    console.error("[invoice/receipt]", err);
    // Reportar ao Sentry explicitamente — este catch engole a excepção e devolve
    // JSON 500, por isso a instrumentação automática do Sentry (que só apanha
    // excepções não tratadas) nunca via este erro. Sem isto ficamos cegos:
    // "detail: String(err)" só mostra a mensagem minificada do React, nunca a
    // stack trace real com sourcemaps. Contexto extra ajuda a isolar se o
    // problema é específico de facturas ligadas a reserva de sala.
    Sentry.captureException(err, {
      tags:  { route: "invoices/[id]/receipt" },
      extra: { invoiceId: params.id },
    });
    return NextResponse.json(
      { error: "Erro ao gerar recibo", detail: String(err) },
      { status: 500 }
    );
  }
}
