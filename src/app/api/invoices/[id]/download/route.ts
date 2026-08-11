export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type InvoiceData } from "@/lib/invoice-pdf";
import { renderPdfInWorker } from "@/lib/pdf-worker-client";
import { calcTotalContracted, calcContractMonths } from "@/lib/finance";
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
    // ── auth ────────────────────────────────────────────────────────────
    const { error: authError } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO, AdminRole.COMERCIAL);
    if (authError) return authError;

    // ── dados da fatura + empresa ────────────────────────────────────────
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { company: true },
    });

    // ── se ligada a reserva de sala, buscar dados ────────────────────────
    let reservation: { eventName: string | null; responsible: string | null; startDatetime: Date; endDatetime: Date; totalHours: number; coffeeBreak: boolean; amount: number; totalAmount: number; discount: number; iva: number; amountPaid: number; plan: { name: string } | null } | null = null;
    if (invoice?.reservationId) {
      reservation = await prisma.reservation.findUnique({
        where: { id: invoice.reservationId },
        select: {
          eventName: true, responsible: true,
          startDatetime: true, endDatetime: true, totalHours: true,
          coffeeBreak: true, amount: true, totalAmount: true,
          discount: true, iva: true, amountPaid: true,
          plan: { select: { name: true } },
        },
      });
    }

    if (!invoice) {
      return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 });
    }

    // ── logo em base64 ───────────────────────────────────────────────────
    const logoPath = path.join(process.cwd(), "public", "assets", "logo-recibo.jpg");
    let logoBase64 = "";
    if (fs.existsSync(logoPath)) {
      const raw = fs.readFileSync(logoPath);
      logoBase64 = `data:image/jpeg;base64,${raw.toString("base64")}`;
    }

    // ── formatar datas ───────────────────────────────────────────────────
    const fmt = (d: Date) => format(d, "dd/MM/yyyy", { locale: pt });
    const refNum = invoice.invoiceNumber.replace("FT-", "");

    // ── calcular dados do contrato (apenas se ligado a empresa) ─────────────
    const co = invoice.company;
    const months          = co ? calcContractMonths(co.contractStart, co.contractEnd) : 0;
    const totalContracted = co ? calcTotalContracted(co.rentAmount, co.contractStart, co.contractEnd) : 0;
    let totalPaid = 0;
    let balance   = 0;
    if (invoice.companyId) {
      const paidAgg = await prisma.payment.aggregate({
        where: { companyId: invoice.companyId, status: "PAGO" },
        _sum: { amount: true },
      });
      totalPaid = paidAgg._sum.amount ?? 0;
      balance   = totalContracted - totalPaid;
    }

    // ── montar dados tipados ─────────────────────────────────────────────
    const isSala = !!reservation;
    const salaTotal = reservation
      ? (reservation.totalAmount > 0 ? reservation.totalAmount : reservation.amount)
      : 0;

    const inv: InvoiceData = {
      invoiceNumber:   invoice.invoiceNumber,
      receiptRef:      `AZC/REC/${refNum}`,
      issueDate:       fmt(new Date(invoice.issueDate)),
      dueDate:         fmt(new Date(invoice.dueDate)),
      status:          invoice.status,
      paymentMethod:   invoice.paymentMethod || "Transferência Bancária",
      serviceType:     invoice.serviceType || (isSala ? "Salas de Reunião" : ""),
      amount:          isSala ? salaTotal : invoice.amount,
      notes:           invoice.notes,
      // escritório fields (only when not a sala invoice)
      totalContracted: !isSala ? (totalContracted || undefined) : undefined,
      totalPaid:       !isSala ? (totalPaid       || undefined) : undefined,
      balance:         !isSala ? (balance         || undefined) : undefined,
      months:          !isSala ? (months          || undefined) : undefined,
      // sala fields
      ...(isSala && reservation ? {
        isSalaReuniao:   true,
        salaEventName:   reservation.eventName   || "",
        salaResponsavel: reservation.responsible || (co?.responsible ?? ""),
        salaPlanName:    reservation.plan?.name  || "",
        salaDataInicio:  fmt(new Date(reservation.startDatetime)),
        salaDataFim:     fmt(new Date(reservation.endDatetime)),
        salaDuracao:     `${reservation.totalHours}h`,
        salaCoffeeBreak: reservation.coffeeBreak,
        totalAmount:     salaTotal,
        discount:        reservation.discount  || 0,
        iva:             reservation.iva       || 0,
        amountPaid:      reservation.amountPaid || 0,
      } : {}),
      company: {
        name:        co?.name        ?? (reservation ? (invoice.company?.name ?? "Cliente") : "Cliente"),
        nif:         co?.nif         ?? null,
        email:       co?.email       ?? "",
        whatsapp:    co?.whatsapp    ?? "",
        responsible: co?.responsible ?? (reservation?.responsible ?? ""),
        roomNumber:  co?.roomNumber  ?? "",
        planType:    co?.planType    ?? "",
      },
      logoBase64,
    };

    // ── gerar PDF ────────────────────────────────────────────────────────
    // 05 Ago 2026: geração corre num processo Node isolado, fora do bundler
    // do Next.js — ver src/lib/pdf-worker-client.ts.
    const pdfBuffer = await renderPdfInWorker("invoice-download", inv);

    // ── nome do ficheiro ─────────────────────────────────────────────────
    const safeName = (isSala
      ? (reservation?.eventName ?? co?.name ?? "sala")
      : (co?.name ?? "cliente")
    ).replace(/[^a-zA-Z0-9]/g, "_");
    const filename  = `Recibo_${refNum}_${safeName}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });

  } catch (err) {
    console.error("[invoice/download]", err);
    // Ver nota em invoices/[id]/receipt/route.ts — sem captureException explícito
    // este erro nunca chega ao Sentry (é apanhado aqui, não propaga).
    Sentry.captureException(err, {
      tags:  { route: "invoices/[id]/download" },
      extra: { invoiceId: params.id },
    });
    return NextResponse.json(
      { error: "Erro ao gerar PDF", detail: String(err) },
      { status: 500 }
    );
  }
}
