import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const month = searchParams.get("month");
  const q = searchParams.get("q");
  const where: any = {};
  if (status && status !== "ALL") where.status = status;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    where.dueDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (q) where.company = { name: { contains: q, mode: "insensitive" } };
  const payments = await prisma.payment.findMany({
    where,
    include: { company: { select: { id: true, name: true } } },
    orderBy: { dueDate: "desc" },
    take: 100,
  });
  const [sumPago, sumPendente, sumAtrasado] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "PAGO" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PENDENTE" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "ATRASADO" }, _sum: { amount: true } }),
  ]);
  return NextResponse.json({
    payments,
    summary: {
      pago: sumPago._sum.amount || 0,
      pendente: sumPendente._sum.amount || 0,
      atrasado: sumAtrasado._sum.amount || 0,
    }
  });
}
