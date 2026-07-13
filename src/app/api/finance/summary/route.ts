import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calcTotalContracted } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const now          = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear  = new Date(now.getFullYear(), 0, 1);
  const in7days      = new Date(now);
  in7days.setDate(in7days.getDate() + 7);

  // ── Todos os queries em paralelo (sem loop!) ─────────────────────────────
  const [
    receitaMesAgg,
    receitaAnualAgg,
    totalRecebidoAgg,
    totalPendenteAgg,
    totalAtrasadoAgg,
    mrrAgg,
    empresasEmAtrasoGroupBy,
    caixaAnnualAgg,
    despesasCatGroupBy,
    alertasVencer,
    alertasAtrasados,
    activeCompanies,
    // Monthly payments (12m) — single query, group in memory
    paymentsLast12m,
    expensesLast12m,
    salaLast12m,
    salaReceitaMesAgg,
    salaReceitaAnualAgg,
    salaPendenteAgg,
  ] = await Promise.all([
    // KPIs
    prisma.payment.aggregate({ where: { status: "PAGO", paidDate: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PAGO", paidDate: { gte: startOfYear  } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PAGO"     }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PENDENTE" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "ATRASADO" }, _sum: { amount: true } }),
    prisma.company.aggregate({ where: { contractStatus: "ATIVO" }, _sum: { rentAmount: true } }),
    prisma.payment.groupBy({ by: ["companyId"], where: { status: "ATRASADO" }, _count: { id: true } }),
    prisma.expense.aggregate({ where: { status: "PAGO", expenseDate: { gte: startOfYear } }, _sum: { amount: true } }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { status: "PAGO" },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.payment.findMany({
      where: { status: "PENDENTE", dueDate: { gte: now, lte: in7days } },
      include: { company: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.payment.findMany({
      where: { status: "ATRASADO" },
      include: { company: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    // Companies
    prisma.company.findMany({
      where: { contractStatus: { not: "ENCERRADO" } },
      select: { rentAmount: true, contractStart: true, contractEnd: true },
    }),
    // Monthly aggregates — fetch all at once, group in memory
    prisma.payment.findMany({
      where: { status: "PAGO", paidDate: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } },
      select: { paidDate: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { status: "PAGO", expenseDate: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } },
      select: { expenseDate: true, amount: true },
    }),
    // Sala monthly
    prisma.reservation.findMany({
      where: { paymentStatus: "PAGO", startDatetime: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } },
      select: { startDatetime: true, totalAmount: true },
    }),
    // Sala KPIs
    prisma.reservation.aggregate({
      where: { paymentStatus: "PAGO", startDatetime: { gte: startOfMonth } },
      _sum: { totalAmount: true },
    }),
    prisma.reservation.aggregate({
      where: { paymentStatus: "PAGO", startDatetime: { gte: startOfYear } },
      _sum: { totalAmount: true },
    }),
    prisma.reservation.aggregate({
      where: { paymentStatus: "PENDENTE", status: { notIn: ["CANCELADA"] } },
      _sum: { totalAmount: true },
    }),
  ]);

  // ── Build monthly chart data in memory ────────────────────────────────────
  const monthlyData: { month: string; receita: number; despesa: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

    const rec = paymentsLast12m
      .filter(p => p.paidDate && p.paidDate >= d && p.paidDate < nextD)
      .reduce((s, p) => s + p.amount, 0);

    const desp = expensesLast12m
      .filter(e => e.expenseDate >= d && e.expenseDate < nextD)
      .reduce((s, e) => s + e.amount, 0);

    const sala = salaLast12m
      .filter(r => r.startDatetime >= d && r.startDatetime < nextD)
      .reduce((s, r) => s + (r.totalAmount || 0), 0);

    monthlyData.push({
      month:   d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" }),
      receita: rec + sala,
      despesa: desp,
    });
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const totalContratado    = activeCompanies.reduce(
    (s, c) => s + calcTotalContracted(c.rentAmount, c.contractStart, c.contractEnd), 0
  );
  const totalPagoGeral     = totalRecebidoAgg._sum.amount || 0;
  const totalEmDivida      = Math.max(0, totalContratado - totalPagoGeral);
  const salaReceitaMesVal  = salaReceitaMesAgg._sum.totalAmount  || 0;
  const salaReceitaAnualVal= salaReceitaAnualAgg._sum.totalAmount || 0;
  const salaPendenteVal    = salaPendenteAgg._sum.totalAmount    || 0;

  const serializePayment = (p: typeof alertasVencer[0]) => ({
    ...p,
    dueDate:   p.dueDate.toISOString(),
    paidDate:  p.paidDate ? p.paidDate.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  });

  return NextResponse.json({
    receitaMes:        (receitaMesAgg._sum.amount  || 0) + salaReceitaMesVal,
    receitaAnual:      (receitaAnualAgg._sum.amount || 0) + salaReceitaAnualVal,
    totalRecebido:     totalPagoGeral,
    salaReceitaMes:    salaReceitaMesVal,
    salaReceitaAnual:  salaReceitaAnualVal,
    salaPendente:      salaPendenteVal,
    totalPendente:    (totalPendenteAgg._sum.amount || 0) + salaPendenteVal,
    totalAtrasado:     totalAtrasadoAgg._sum.amount    || 0,
    mrr:               mrrAgg._sum.rentAmount          || 0,
    previsao:          totalPendenteAgg._sum.amount    || 0,
    empresasEmAtraso:  empresasEmAtrasoGroupBy.length,
    caixaAtual:       (receitaAnualAgg._sum.amount || 0) - (caixaAnnualAgg._sum.amount || 0),
    totalContratado,
    totalEmDivida,
    receitaMensal:     monthlyData,
    despesasPorCategoria: despesasCatGroupBy.map((d) => ({ category: d.category, total: d._sum.amount || 0 })),
    alertasVencer:     alertasVencer.map(serializePayment),
    alertasAtrasados:  alertasAtrasados.map(serializePayment),
  });
}
