import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const [statusGroups, total, convertedWithDates] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.lead.count(),
    prisma.lead.findMany({
      where: { status: "CONVERTIDO", convertedAt: { not: null } },
      select: { createdAt: true, convertedAt: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const g of statusGroups) {
    byStatus[g.status] = g._count._all;
  }

  const funnel = {
    total,
    novo:       byStatus["NOVO"]        ?? 0,
    contactado: byStatus["CONTACTADO"]  ?? 0,
    proposta:   byStatus["PROPOSTA"]    ?? 0,
    negociacao: byStatus["NEGOCIACAO"]  ?? 0,
    convertido: byStatus["CONVERTIDO"]  ?? 0,
    perdido:    byStatus["PERDIDO"]     ?? 0,
  };

  const conversionRate =
    total > 0
      ? Math.round((funnel.convertido / total) * 1000) / 10
      : 0;

  let avgDaysToConvert = 0;
  if (convertedWithDates.length > 0) {
    const totalDays = convertedWithDates.reduce((sum, l) => {
      if (!l.convertedAt) return sum;
      return (
        sum +
        Math.abs(
          (l.convertedAt.getTime() - l.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
    }, 0);
    avgDaysToConvert = Math.round(totalDays / convertedWithDates.length);
  }

  return NextResponse.json({ funnel, conversionRate, avgDaysToConvert });
}
