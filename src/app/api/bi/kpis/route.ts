import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    activeCompanies,
    mrrAgg,
    pendingPayments,
    upcomingReservations,
    pendingDeleteRequests,
  ] = await Promise.all([
    prisma.company.count({
      where: { contractStatus: { in: ["ATIVO", "PRESTES_EXPIRAR"] } },
    }),
    prisma.company.aggregate({
      where: { contractStatus: { in: ["ATIVO", "PRESTES_EXPIRAR"] } },
      _sum: { rentAmount: true },
    }),
    prisma.payment.count({
      where: { status: { in: ["PENDENTE", "ATRASADO"] } },
    }),
    prisma.reservation.count({
      where: {
        status: "CONFIRMADA",
        startDatetime: { gte: now, lte: weekAhead },
      },
    }),
    prisma.deleteRequest.count({ where: { status: "PENDING" } }),
  ]);

  return NextResponse.json({
    activeCompanies,
    mrr: mrrAgg._sum.rentAmount ?? 0,
    pendingPayments,
    upcomingReservations,
    pendingDeleteRequests,
  });
}
