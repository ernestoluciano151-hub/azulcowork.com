import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SALA_LIMIT_MINUTES = 120; // 2 horas/mês incluídas no plano
const PRINT_LIMIT        = 30;  // 30 impressões/mês incluídas no plano

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");
  const now   = new Date();
  const year  = monthParam ? parseInt(monthParam.split("-")[0]) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam.split("-")[1]) : now.getMonth() + 1;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);

  // Todas as empresas (exceto encerradas)
  const companies = await prisma.company.findMany({
    where: { contractStatus: { not: "ENCERRADO" } },
    select: { id: true, name: true, planType: true, contractStatus: true },
    orderBy: { name: "asc" },
  });

  if (companies.length === 0) {
    return NextResponse.json({ data: [], month: `${year}-${String(month).padStart(2, "0")}` });
  }

  const ids = companies.map(c => c.id);

  // Horas de sala usadas — campos correctos: startDatetime/endDatetime, status PT
  const reservations = await prisma.reservation.findMany({
    where: {
      companyId:     { in: ids },
      status:        { in: ["CONFIRMADA", "CONCLUIDA", "CONFIRMED", "COMPLETED"] },
      startDatetime: { gte: monthStart, lte: monthEnd },
    },
    select: { companyId: true, startDatetime: true, endDatetime: true },
  });

  // Impressões registadas via Timeline (type = IMPRESSAO)
  const prints = await prisma.timeline.findMany({
    where: {
      companyId: { in: ids },
      type:      "IMPRESSAO",
      createdAt: { gte: monthStart, lte: monthEnd },
    },
    select: { companyId: true, amount: true },
  });

  // Agregar por empresa
  const salaMap:  Record<string, number> = {};
  const printMap: Record<string, number> = {};

  for (const r of reservations) {
    if (!r.companyId) continue;
    const mins = (new Date(r.endDatetime).getTime() - new Date(r.startDatetime).getTime()) / 60000;
    salaMap[r.companyId] = (salaMap[r.companyId] || 0) + mins;
  }
  for (const p of prints) {
    if (!p.companyId) continue;
    printMap[p.companyId] = (printMap[p.companyId] || 0) + (p.amount || 0);
  }

  const data = companies.map(c => ({
    id:             c.id,
    name:           c.name,
    plan:           c.planType,
    contractStatus: c.contractStatus,
    salaMinutes:    Math.round(salaMap[c.id] || 0),
    salaLimit:      SALA_LIMIT_MINUTES,
    prints:         Math.round(printMap[c.id] || 0),
    printLimit:     PRINT_LIMIT,
  }));

  return NextResponse.json({ data, month: `${year}-${String(month).padStart(2, "0")}` });
}

// POST — registar impressões manualmente
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { companyId, count, notes } = await req.json();
  if (!companyId || !count || count < 1) {
    return NextResponse.json({ error: "companyId e count obrigatórios" }, { status: 400 });
  }

  const entry = await prisma.timeline.create({
    data: {
      companyId,
      type:        "IMPRESSAO",
      title:       `${count} impressão(ões) registada(s)`,
      description: notes || null,
      amount:      count,
      createdBy:   session.name || session.email,
    },
  });

  return NextResponse.json({ ok: true, entry });
}
