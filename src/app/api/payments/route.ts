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
  const {
    companyId, amount, dueDate, paidDate,
    paymentMethod, notes, status, category,
    receiptUrl, doc2Url, operationRef,
  } = data;

  if (!companyId || !amount || !dueDate) {
    return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
  }

  const isPago    = (status || "PENDENTE") === "PAGO";
  const amountNum = Number(amount);

  // ── auto-gerar número de recibo ──────────────────────────────────────────
  const year  = new Date().getFullYear();
  const count = await prisma.payment.count({
    where: { receiptNumber: { startsWith: `REC-${year}-` } },
  });
  const receiptNumber = `REC-${year}-${String(count + 1).padStart(6, "0")}`;

  // ── saldo anterior (auditoria) ───────────────────────────────────────────
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  let previousBalance: number | null = null;
  if (company) {
    const paidAgg = await prisma.payment.aggregate({
      where: { companyId, status: "PAGO" },
      _sum: { amount: true },
    });
    const { calcTotalContracted } = await import("@/lib/finance");
    const totalContracted = calcTotalContracted(company.rentAmount, company.contractStart, company.contractEnd);
    previousBalance = totalContracted - (paidAgg._sum.amount ?? 0);
  }

  const payment = await prisma.payment.create({
    data: {
      companyId,
      amount:          amountNum,
      dueDate:         new Date(dueDate),
      paidDate:        isPago ? (paidDate ? new Date(paidDate) : new Date()) : null,
      paymentMethod:   paymentMethod || null,
      notes:           notes || null,
      status:          status || "PENDENTE",
      category:        category || null,
      receiptUrl:      receiptUrl || null,
      doc2Url:         doc2Url || null,
      operationRef:    operationRef || null,
      receiptNumber,
      previousBalance,
    },
    include: { company: { select: { id: true, name: true } } },
  });

  // ── registar no histórico se pago ────────────────────────────────────────
  if (isPago && companyId) {
    await recordFinancialHistory(prisma, {
      companyId,
      type:        "PAGAMENTO",
      description: `${receiptNumber} — ${payment.company?.name ?? "empresa"}`,
      amount:      amountNum,
      method:      paymentMethod || undefined,
      reference:   payment.id,
      createdBy:   session.name || session.email,
    });
  }

  return NextResponse.json(payment, { status: 201 });
}
