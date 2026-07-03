import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordFinancialHistory } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status    = searchParams.get("status");
  const month     = searchParams.get("month");
  const q         = searchParams.get("q");
  const companyId = searchParams.get("companyId");

  const where: Record<string, unknown> = {};
  if (status && status !== "ALL") where.status = status;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    where.dueDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (q)         where.company = { name: { contains: q, mode: "insensitive" } };
  if (companyId) where.companyId = companyId;

  const payments = await prisma.payment.findMany({
    where,
    include: { company: { select: { id: true, name: true } } },
    orderBy: { dueDate: "desc" },
    take: 200,
  });

  const [sumPago, sumPendente, sumAtrasado] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "PAGO"     }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PENDENTE" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "ATRASADO" }, _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    payments,
    summary: {
      pago:      sumPago._sum.amount     || 0,
      pendente:  sumPendente._sum.amount || 0,
      atrasado:  sumAtrasado._sum.amount || 0,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const data = await req.json();
  const { companyId, amount, dueDate, paymentMethod, notes, status, category } = data;

  if (!companyId || !amount || !dueDate) {
    return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
  }

  const isPago = (status || "PENDENTE") === "PAGO";

  const payment = await prisma.payment.create({
    data: {
      companyId,
      amount:        Number(amount),
      dueDate:       new Date(dueDate),
      paidDate:      isPago ? new Date() : null,
      paymentMethod: paymentMethod || null,
      notes:         notes || null,
      status:        status || "PENDENTE",
      category:      category || null,
    },
    include: { company: { select: { id: true, name: true } } },
  });

  // ── registar no histórico se pago ────────────────────────────────────────
  if (isPago) {
    await recordFinancialHistory(prisma, {
      companyId,
      type:        "PAGAMENTO",
      description: `Pagamento registado — ${payment.company.name}`,
      amount:      Number(amount),
      method:      paymentMethod || undefined,
      reference:   payment.id,
      createdBy:   session.name || session.email,
    });
  }

  return NextResponse.json(payment, { status: 201 });
}
