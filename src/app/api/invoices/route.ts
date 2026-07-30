import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { nextDocumentNumber } from "@/lib/document-numbering";
import { isApiRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO, AdminRole.COMERCIAL);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const status = searchParams.get("status");
  const month = searchParams.get("month");
  const q = searchParams.get("q");

  const where: Record<string, unknown> = {};
  if (companyId) where.companyId = companyId;
  if (status && status !== "ALL") where.status = status;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    where.issueDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (q) where.OR = [
    { company:     { name:          { contains: q, mode: "insensitive" } } },
    { invoiceNumber: { contains: q, mode: "insensitive" } },
    { serviceType:   { contains: q, mode: "insensitive" } },
  ];

  const invoices = await prisma.invoice.findMany({
    where,
    include: { company: { select: { id: true, name: true } } },
    orderBy: { issueDate: "desc" },
    take: 200,
  });

  // Fix legacy invoices where totalAmount was not set (0) but amount is set
  const fixed = invoices.map(inv => ({
    ...inv,
    totalAmount: inv.totalAmount > 0 ? inv.totalAmount : inv.amount,
    balance:     inv.balance     > 0 ? inv.balance     : Math.max(0, (inv.totalAmount || inv.amount) - (inv.amountPaid || 0)),
  }));

  return NextResponse.json({ invoices: fixed });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "invoices")) {
    return NextResponse.json({ error: "Demasiados pedidos. Aguarde um momento." }, { status: 429 });
  }

  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const data = await req.json();
  const { companyId, serviceType, amount, issueDate, dueDate, paymentMethod, notes } = data;

  if (!companyId || !serviceType || !amount || !dueDate) {
    return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
  }

  const amountNum     = Number(amount);
  const discountNum   = Number(data.discount  || 0);
  const ivaNum        = Number(data.iva       || 0);
  const afterDiscount = amountNum - discountNum;
  const totalAmount   = afterDiscount + (afterDiscount * ivaNum / 100);

  // Numeração atómica: FT-CWORK-YYYY-NNNNNN (DT-014)
  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextDocumentNumber(tx, "FT-CWORK");

    return tx.invoice.create({
      data: {
        invoiceNumber,
        companyId,
        serviceType,
        amount:        amountNum,
        discount:      discountNum,
        iva:           ivaNum,
        totalAmount,
        balance:       totalAmount,
        issueDate:     issueDate ? new Date(issueDate) : new Date(),
        dueDate:       new Date(dueDate),
        paymentMethod: paymentMethod || null,
        notes:         notes || null,
      },
      include: { company: { select: { id: true, name: true } } },
    });
  });

  return NextResponse.json(invoice, { status: 201 });
}
