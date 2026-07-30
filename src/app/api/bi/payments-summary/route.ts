import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AdminRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const [cwPaid, cwPending, cwOverdue, salaPaid, salaPending] =
    await Promise.all([
      prisma.payment.aggregate({
        where: { status: "PAGO" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { status: "PENDENTE" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { status: "ATRASADO" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.reservation.aggregate({
        where: { paymentStatus: "PAGO" },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.reservation.aggregate({
        where: { paymentStatus: "PENDENTE" },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
    ]);

  return NextResponse.json({
    coworking: {
      paid:    { count: cwPaid._count._all,    total: cwPaid._sum.amount    ?? 0 },
      pending: { count: cwPending._count._all, total: cwPending._sum.amount ?? 0 },
      overdue: { count: cwOverdue._count._all, total: cwOverdue._sum.amount ?? 0 },
    },
    sala: {
      paid:    { count: salaPaid._count._all,    total: salaPaid._sum.totalAmount    ?? 0 },
      pending: { count: salaPending._count._all, total: salaPending._sum.totalAmount ?? 0 },
    },
    combined: {
      totalRevenue:
        (cwPaid._sum.amount ?? 0) + (salaPaid._sum.totalAmount ?? 0),
      totalPending:
        (cwPending._sum.amount ?? 0) + (salaPending._sum.totalAmount ?? 0),
      totalOverdue: cwOverdue._sum.amount ?? 0,
    },
  });
}
