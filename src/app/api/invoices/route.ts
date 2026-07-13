import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

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
  if (q) where.company = { name: { contains: q, mode: "insensitive" } };

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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const data = await req.json();
  const { companyId, serviceType, amount, issueDate, dueDate, paymentMethod, notes } = data;

  if (!companyId || !serviceType || !amount || !dueDate) {
    return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
  }

  // Auto-generate invoice number
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `FT-${year}-` } },
  });
  const invoiceNumber = `FT-${year}-${String(count + 1).padStart(4, "0")}`;

  const amountNum    = Number(amount);
  const discountNum  = Number(data.discount  || 0);
  const ivaNum       = Number(data.iva       || 0);
  const afterDiscount = amountNum - discountNum;
  const totalAmount   = afterDiscount + (afterDiscount * ivaNum / 100);

  const invoice = await prisma.invoice.create({
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

  return NextResponse.json(invoice, { status: 201 });
}
