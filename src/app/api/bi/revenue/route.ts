import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AdminRole } from "@prisma/client";
import { monthKey, lastNMonths } from "@/lib/bi-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const url = new URL(req.url);
  const months = Math.min(
    Math.max(parseInt(url.searchParams.get("months") ?? "12", 10), 1),
    24
  );

  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [coworkingPayments, salaReservations] = await Promise.all([
    // Coworking: pagamentos confirmados (excluindo os ligados a reservas)
    prisma.payment.findMany({
      where: {
        status: "PAGO",
        paidDate: { gte: since },
        reservationId: null,
      },
      select: { paidDate: true, amount: true },
    }),
    // Sala: reservas com pagamento confirmado
    prisma.reservation.findMany({
      where: {
        paymentStatus: "PAGO",
        startDatetime: { gte: since },
      },
      select: { startDatetime: true, paidDate: true, totalAmount: true },
    }),
  ]);

  const monthsList = lastNMonths(months);
  const coworkingMap: Record<string, number> = Object.fromEntries(monthsList.map(m => [m, 0]));
  const salaMap: Record<string, number> = Object.fromEntries(monthsList.map(m => [m, 0]));

  for (const p of coworkingPayments) {
    if (!p.paidDate) continue;
    const key = monthKey(p.paidDate);
    if (key in coworkingMap) coworkingMap[key] += p.amount;
  }

  for (const r of salaReservations) {
    const dateToUse = r.paidDate ?? r.startDatetime;
    const key = monthKey(dateToUse);
    if (key in salaMap) salaMap[key] += r.totalAmount;
  }

  const result = monthsList.map((m) => ({
    month: m,
    coworking: Math.round(coworkingMap[m]),
    sala: Math.round(salaMap[m]),
    total: Math.round(coworkingMap[m] + salaMap[m]),
  }));

  const totals = result.reduce(
    (acc, r) => ({
      coworking: acc.coworking + r.coworking,
      sala: acc.sala + r.sala,
      total: acc.total + r.total,
    }),
    { coworking: 0, sala: 0, total: 0 }
  );

  return NextResponse.json({ months: result, totals });
}
