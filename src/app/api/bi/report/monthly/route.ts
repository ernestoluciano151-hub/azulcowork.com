import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AdminRole } from "@prisma/client";
import { monthKey } from "@/lib/bi-helpers";

export const dynamic = "force-dynamic";

/** Devolve o relatório executivo consolidado de um mês específico (YYYY-MM). */
export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month");

  // Validar formato YYYY-MM
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json(
      { error: "Parâmetro 'month' obrigatório no formato YYYY-MM." },
      { status: 400 }
    );
  }

  const [year, month] = monthParam.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 1); // exclusivo

  const [
    cwPaid,
    cwPending,
    cwOverdue,
    salaReservations,
    salaReservationsCount,
    newLeads,
    convertedLeads,
    activeCompanies,
    mrrAgg,
  ] = await Promise.all([
    // Coworking: pagamentos PAGO neste mês
    prisma.payment.aggregate({
      where: {
        status: "PAGO",
        paidDate: { gte: monthStart, lt: monthEnd },
        reservationId: null,
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Coworking: pagamentos PENDENTE (estado actual, não filtrado por mês)
    prisma.payment.aggregate({
      where: { status: "PENDENTE" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Coworking: pagamentos ATRASADO (estado actual)
    prisma.payment.aggregate({
      where: { status: "ATRASADO" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Sala: reservas pagas neste mês (por startDatetime)
    prisma.reservation.findMany({
      where: {
        paymentStatus: "PAGO",
        startDatetime: { gte: monthStart, lt: monthEnd },
      },
      select: { totalAmount: true, totalHours: true },
    }),
    // Sala: total de reservas no mês (qualquer estado excepto CANCELADA)
    prisma.reservation.count({
      where: {
        status: { notIn: ["CANCELADA"] },
        startDatetime: { gte: monthStart, lt: monthEnd },
      },
    }),
    // Leads novos no mês
    prisma.lead.count({
      where: { createdAt: { gte: monthStart, lt: monthEnd } },
    }),
    // Leads convertidos no mês
    prisma.lead.count({
      where: {
        status: "CONVERTIDO",
        convertedAt: { gte: monthStart, lt: monthEnd },
      },
    }),
    // Empresas activas (estado actual)
    prisma.company.count({
      where: { contractStatus: { in: ["ATIVO", "PRESTES_EXPIRAR"] } },
    }),
    // MRR (estado actual)
    prisma.company.aggregate({
      where: { contractStatus: { in: ["ATIVO", "PRESTES_EXPIRAR"] } },
      _sum: { rentAmount: true },
    }),
  ]);

  const salaRevenue    = salaReservations.reduce((s, r) => s + r.totalAmount, 0);
  const salaHours      = salaReservations.reduce((s, r) => s + r.totalHours, 0);
  const totalRevenue   = (cwPaid._sum.amount ?? 0) + salaRevenue;
  const conversionRate = newLeads > 0 ? Math.round((convertedLeads / newLeads) * 1000) / 10 : 0;

  return NextResponse.json({
    month: monthParam,
    generatedAt: new Date().toISOString(),
    financial: {
      coworkingRevenue: cwPaid._sum.amount ?? 0,
      coworkingPaidCount: cwPaid._count._all,
      salaRevenue,
      salaHoursBooked: Math.round(salaHours * 10) / 10,
      totalRevenue,
      pendingPayments:  { count: cwPending._count._all, total: cwPending._sum.amount ?? 0 },
      overduePayments:  { count: cwOverdue._count._all, total: cwOverdue._sum.amount ?? 0 },
    },
    sala: {
      reservationsCount: salaReservationsCount,
      paidCount: salaReservations.length,
      hoursBooked: Math.round(salaHours * 10) / 10,
      revenue: salaRevenue,
    },
    crm: {
      newLeads,
      convertedLeads,
      conversionRate,
    },
    operations: {
      activeCompanies,
      mrr: mrrAgg._sum.rentAmount ?? 0,
    },
  });
}
