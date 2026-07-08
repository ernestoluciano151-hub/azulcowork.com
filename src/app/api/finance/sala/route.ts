/**
 * GET /api/finance/sala
 * Financial KPIs for the meeting room module.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(todayStart.getTime() + 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const yearStart  = new Date(now.getFullYear(), 0, 1);

  const [
    allReservations,
    todayRes,
    monthRes,
    yearRes,
  ] = await Promise.all([
    prisma.reservation.findMany({
      where:   { status: { notIn: ["CANCELADA"] } },
      include: { plan: true, company: { select: { id: true, name: true } } },
    }),
    prisma.reservation.findMany({
      where: {
        status:       { notIn: ["CANCELADA"] },
        startDatetime: { gte: todayStart, lt: todayEnd },
      },
      include: { plan: true, company: { select: { id: true, name: true } } },
    }),
    prisma.reservation.findMany({
      where: {
        status:       { notIn: ["CANCELADA"] },
        startDatetime: { gte: monthStart, lte: monthEnd },
      },
      include: { plan: true, company: { select: { id: true, name: true } } },
    }),
    prisma.reservation.findMany({
      where: {
        status:       { notIn: ["CANCELADA"] },
        startDatetime: { gte: yearStart },
      },
      include: { plan: true, company: { select: { id: true, name: true } } },
    }),
  ]);

  // Revenue helpers
  const sumPaid  = (list: typeof allReservations) =>
    list.filter(r => r.paymentStatus === "PAGO").reduce((s, r) => s + r.totalAmount, 0);
  const sumTotal = (list: typeof allReservations) =>
    list.reduce((s, r) => s + r.totalAmount, 0);
  const sumHours = (list: typeof allReservations) =>
    list.reduce((s, r) => s + r.totalHours, 0);

  // Occupancy: assuming 8 working hours/day, 22 days/month
  const monthHours     = sumHours(monthRes);
  const availableHours = 22 * 8;
  const occupancyRate  = Math.min(100, Math.round((monthHours / availableHours) * 100));

  // Plan breakdown
  const planMap: Record<string, { name: string; count: number; revenue: number; hours: number }> = {};
  for (const r of monthRes) {
    const k = r.plan.name;
    if (!planMap[k]) planMap[k] = { name: k, count: 0, revenue: 0, hours: 0 };
    planMap[k].count++;
    if (r.paymentStatus === "PAGO") planMap[k].revenue += r.totalAmount;
    planMap[k].hours += r.totalHours;
  }
  const planBreakdown = Object.values(planMap).sort((a, b) => b.revenue - a.revenue);
  const topPlan       = planBreakdown[0]?.name || "—";

  // Top company
  const companyMap: Record<string, { name: string; count: number }> = {};
  for (const r of monthRes) {
    const k = r.companyId || r.companyName || "Externo";
    const n = r.company?.name || r.companyName || "Externo";
    if (!companyMap[k]) companyMap[k] = { name: n, count: 0 };
    companyMap[k].count++;
  }
  const topCompany = Object.values(companyMap).sort((a, b) => b.count - a.count)[0]?.name ?? "—";

  // Average value
  const avgValue = monthRes.length > 0 ? sumPaid(monthRes) / monthRes.length : 0;

  return NextResponse.json({
    // Today
    receitaHoje:          sumPaid(todayRes),
    reservasHoje:         todayRes.length,

    // Month
    receitaMes:           sumPaid(monthRes),
    receitaMesTotal:      sumTotal(monthRes),   // includes pending
    reservasMes:          monthRes.length,
    confirmadasMes:       monthRes.filter(r => r.status === "CONFIRMADA").length,
    pendentesMes:         monthRes.filter(r => r.paymentStatus === "PENDENTE").length,
    horasVendidasMes:     monthHours,
    horasDisponiveisMes:  availableHours,
    taxaOcupacao:         occupancyRate,
    valorMedioReserva:    avgValue,
    topPlan,
    topCompany,
    planBreakdown,

    // Year
    receitaAnual:         sumPaid(yearRes),
    reservasAnual:        yearRes.length,

    // All time
    receitaTotal:         sumPaid(allReservations),
    reservasTotal:        allReservations.length,
    reservasCanceladas:   allReservations.filter(r => r.status === "CANCELADA").length,

    // Pending financials
    totalPendente:        allReservations.filter(r => r.paymentStatus === "PENDENTE").reduce((s, r) => s + r.totalAmount, 0),
    totalFacturado:       allReservations.filter(r => r.paymentStatus === "FACTURADO").reduce((s, r) => s + r.totalAmount, 0),
    countPendente:        allReservations.filter(r => r.paymentStatus === "PENDENTE" && r.status !== "CANCELADA").length,
  });
}
