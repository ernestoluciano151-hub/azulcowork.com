import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from  = searchParams.get("from");
  const to    = searchParams.get("to");
  const planId = searchParams.get("planId");

  const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const end   = to   ? new Date(to)   : new Date();

  const where: Record<string, unknown> = {
    startDatetime: { gte: start, lte: end },
    status: { in: ["CONFIRMADA", "RESERVADO", "CONCLUIDA"] },
  };
  if (planId) where.planId = planId;

  const [reservations, plans] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: { plan: true },
      orderBy: { startDatetime: "asc" },
    }),
    prisma.meetingPlan.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  // ── métricas gerais ──────────────────────────────────────────────────────────
  const totalReservations = reservations.length;
  const totalHours        = reservations.reduce((s, r) => s + r.totalHours, 0);
  const totalRevenue      = reservations.reduce((s, r) => s + (r.totalAmount || r.amount || 0), 0);
  const totalPaid         = reservations.reduce((s, r) => s + (r.amountPaid  || 0), 0);
  const totalPending      = totalRevenue - totalPaid;
  const avgHoursPerRes    = totalReservations > 0 ? totalHours / totalReservations : 0;
  const avgRevenuePerRes  = totalReservations > 0 ? totalRevenue / totalReservations : 0;

  // ── receita + ocupação por mês ────────────────────────────────────────────────
  const monthMap: Record<string, { month: string; reservations: number; hours: number; revenue: number }> = {};
  for (const r of reservations) {
    const key = r.startDatetime.toISOString().slice(0, 7); // "2025-03"
    if (!monthMap[key]) {
      monthMap[key] = {
        month:        new Date(r.startDatetime).toLocaleString("pt-PT", { month: "short", year: "2-digit", timeZone: "UTC" }),
        reservations: 0,
        hours:        0,
        revenue:      0,
      };
    }
    monthMap[key].reservations++;
    monthMap[key].hours   += r.totalHours;
    monthMap[key].revenue += r.totalAmount || r.amount || 0;
  }
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  // ── por plano ─────────────────────────────────────────────────────────────────
  const planMap: Record<string, { planName: string; reservations: number; hours: number; revenue: number; coffeeBreaks: number }> = {};
  for (const r of reservations) {
    const key = r.planId;
    if (!planMap[key]) {
      planMap[key] = { planName: r.plan?.name ?? "—", reservations: 0, hours: 0, revenue: 0, coffeeBreaks: 0 };
    }
    planMap[key].reservations++;
    planMap[key].hours       += r.totalHours;
    planMap[key].revenue     += r.totalAmount || r.amount || 0;
    if (r.coffeeBreak) planMap[key].coffeeBreaks++;
  }
  const byPlan = Object.values(planMap).sort((a, b) => b.revenue - a.revenue);

  // ── por estado de pagamento ───────────────────────────────────────────────────
  const payStatusMap: Record<string, number> = {};
  for (const r of reservations) {
    const k = r.paymentStatus || "PENDENTE";
    payStatusMap[k] = (payStatusMap[k] || 0) + 1;
  }

  // ── top clientes por receita ───────────────────────────────────────────────────
  const clientMap: Record<string, { name: string; reservations: number; revenue: number }> = {};
  for (const r of reservations) {
    const key = r.companyId || r.responsible || "anon";
    const name = r.companyName || r.responsible || "—";
    if (!clientMap[key]) clientMap[key] = { name, reservations: 0, revenue: 0 };
    clientMap[key].reservations++;
    clientMap[key].revenue += r.totalAmount || r.amount || 0;
  }
  const topClients = Object.values(clientMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ── coffee break stats ────────────────────────────────────────────────────────
  const coffeeBreakCount = reservations.filter(r => r.coffeeBreak).length;
  const coffeeBreakPct   = totalReservations > 0 ? (coffeeBreakCount / totalReservations) * 100 : 0;

  return NextResponse.json({
    period: { from: start.toISOString(), to: end.toISOString() },
    summary: {
      totalReservations,
      totalHours:       Math.round(totalHours * 10) / 10,
      totalRevenue,
      totalPaid,
      totalPending,
      avgHoursPerRes:   Math.round(avgHoursPerRes * 10) / 10,
      avgRevenuePerRes: Math.round(avgRevenuePerRes),
      coffeeBreakCount,
      coffeeBreakPct:   Math.round(coffeeBreakPct),
    },
    byMonth,
    byPlan,
    byPaymentStatus: payStatusMap,
    topClients,
    plans,
  });
}
