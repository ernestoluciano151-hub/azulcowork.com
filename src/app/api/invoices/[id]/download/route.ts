export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument, type InvoiceData } from "@/lib/invoice-pdf";
import { calcTotalContracted, calcContractMonths } from "@/lib/finance";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import path from "path";
import fs from "fs";
import React from "react";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ── auth ────────────────────────────────────────────────────────────
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── dados da fatura + empresa ────────────────────────────────────────
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { company: true },
    });

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

    // ── calcular dados do contrato ───────────────────────────────────────
    const months          = calcContractMonths(invoice.company.contractStart, invoice.company.contractEnd);
    const totalContracted = calcTotalContracted(invoice.company.rentAmount, invoice.company.contractStart, invoice.company.contractEnd);
    const paidAgg         = await prisma.payment.aggregate({
      where: { companyId: invoice.companyId, status: "PAGO" },
      _sum: { amount: true },
    });
    const totalPaid = paidAgg._sum.amount ?? 0;
    const balance   = totalContracted - totalPaid;

    // ── montar dados tipados ─────────────────────────────────────────────
    const inv: InvoiceData = {
      invoiceNumber:   invoice.invoiceNumber,
      receiptRef:      `AZC/REC/${refNum}`,
      issueDate:       fmt(new Date(invoice.issueDate)),
      dueDate:         fmt(new Date(invoice.dueDate)),
      status:          invoice.status,
      paymentMethod:   invoice.paymentMethod || "Transferência Bancária",
      serviceType:     invoice.serviceType,
      amount:          invoice.amount,
      notes:           invoice.notes,
      totalContracted,
      totalPaid,
      balance,
      months,
      company: {
        name:        invoice.company.name,
        nif:         invoice.company.nif,
        email:       invoice.company.email,
        whatsapp:    invoice.company.whatsapp,
        responsible: invoice.company.responsible,
        roomNumber:  invoice.company.roomNumber,
        planType:    invoice.company.planType,
      },
      logoBase64,
    };

    // ── gerar PDF ────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoiceDocument, { inv }) as any
    );

    // ── nome do ficheiro ─────────────────────────────────────────────────
    const safeName = invoice.company.name.replace(/[^a-zA-Z0-9]/g, "_");
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
    return NextResponse.json(
      { error: "Erro ao gerar PDF", detail: String(err) },
      { status: 500 }
    );
  }
}
