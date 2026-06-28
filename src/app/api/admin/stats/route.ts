import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { subDays, startOfDay, format } from "date-fns";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const today = startOfDay(new Date());

  // Leads dos últimos 7 dias (por dia)
  const last7 = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const day = subDays(today, 6 - i);
      const next = subDays(today, 5 - i);
      return prisma.lead.count({
        where: { createdAt: { gte: day, lt: next } }
      }).then((count) => ({ day: format(day, "dd/MM"), count }));
    })
  );

  // Por status
  const byStatus = await prisma.lead.groupBy({
    by: ["status"],
    _count: { id: true }
  });

  return NextResponse.json({ last7, byStatus });
}
