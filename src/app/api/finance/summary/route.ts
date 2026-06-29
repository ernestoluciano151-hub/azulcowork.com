import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const in7days = new Date(now);
  in7days.setDate(in7days.getDate() + 7);

  // Build monthly data for last 12 months
  const monthlyData = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const [rec, desp] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: "PAGO", paidDate: { gte: d, lt: nextD } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { status: "PAGO", expenseDate: { gte: d, lt: nextD } },
        _sum: { amount: true },
      }),
    ]);
    monthlyData.push({
      month: d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" }),
      receita: rec._sum.amount || 0,
      despesa: desp._sum.amount || 0,
    });
  }

  const [
    receitaMes,
    receitaAnual,
    totalRecebido,
    totalPendente,
    totalAtrasado,
    mrr,
    previsao,
    empresasEmAtraso,
    caixaAnnual,
    despesasCat,
    alertasVencer,
    alertasAtrasados,
  ] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "PAGO", paidDate: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PAGO", paidDate: { gte: startOfYear } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PAGO" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PENDENTE" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "ATRASADO" }, _sum: { amount: true } }),
    prisma.company.aggregate({ where: { contractStatus: "ATIVO" }, _sum: { rentAmount: true } }),
    prisma.payment.aggregate({ where: { status: "PENDENTE" }, _sum: { amount: true } }),
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
  ]);

  return NextResponse.json({
    receitaMes: receitaMes._sum.amount || 0,
    receitaAnual: receitaAnual._sum.amount || 0,
    totalRecebido: totalRecebido._sum.amount || 0,
    totalPendente: totalPendente._sum.amount || 0,
    totalAtrasado: totalAtrasado._sum.amount || 0,
    mrr: mrr._sum.rentAmount || 0,
    previsao: previsao._sum.amount || 0,
    empresasEmAtraso: empresasEmAtraso.length,
    caixaAtual: (receitaAnual._sum.amount || 0) - (caixaAnnual._sum.amount || 0),
    receitaMensal: monthlyData,
    despesasPorCategoria: despesasCat.map((d) => ({ category: d.category, total: d._sum.amount || 0 })),
    alertasVencer: alertasVencer.map((p) => ({
      ...p,
      dueDate: p.dueDate.toISOString(),
      paidDate: p.paidDate ? p.paidDate.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    })),
    alertasAtrasados: alertasAtrasados.map((p) => ({
      ...p,
      dueDate: p.dueDate.toISOString(),
      paidDate: p.paidDate ? p.paidDate.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
