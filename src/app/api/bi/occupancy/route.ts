import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { monthKey, lastNMonths, buildOccupancyResult } from "@/lib/bi-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const url = new URL(req.url);
  const months = Math.min(
    Math.max(parseInt(url.searchParams.get("months") ?? "12", 10), 1),
    24
  );
  const dailyHours = Math.min(
    parseInt(process.env.ROOM_DAILY_HOURS ?? "10", 10),
    24
  );

  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { notIn: ["CANCELADA"] },
      startDatetime: { gte: since },
    },
    select: { startDatetime: true, totalHours: true },
  });

  const monthsList = lastNMonths(months);
  const bookedMap: Record<string, number> = Object.fromEntries(monthsList.map(m => [m, 0]));

  for (const r of reservations) {
    const key = monthKey(r.startDatetime);
    if (key in bookedMap) bookedMap[key] += r.totalHours;
  }

  const result = buildOccupancyResult(monthsList, bookedMap, dailyHours);

  const totalBooked = result.reduce((s, r) => s + r.bookedHours, 0);
  const totalAvailable = result.reduce((s, r) => s + r.availableHours, 0);
  const avgRate =
    totalAvailable > 0
      ? Math.round((totalBooked / totalAvailable) * 1000) / 10
      : 0;

  return NextResponse.json({ months: result, avgRate });
}
