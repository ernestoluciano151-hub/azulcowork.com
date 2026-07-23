import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SALA_LIMIT_MINUTES = 120;
const PRINT_LIMIT        = 30;

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

  const companies = await prisma.company.findMany({
    where: { contractStatus: { not: "ENCERRADO" } },
    select: { id: true, name: true, planType: true, contractStatus: true },
    orderBy: { name: "asc" },
  });

  if (companies.length === 0) {
    return NextResponse.json({ data: [], month: `${year}-${String(month).padStart(2, "0")}` });
  }

  const ids = companies.map(c => c.id);

  // Reservas confirmadas no mês (horas de sala automáticas)
  const reservations = await prisma.reservation.findMany({
    where: {
      companyId:     { in: ids },
      status:        { in: ["CONFIRMADA", "CONCLUIDA", "CONFIRMED", "COMPLETED"] },
      startDatetime: { gte: monthStart, lte: monthEnd },
    },
    select: { companyId: true, startDatetime: true, endDatetime: true },
  });

  // Sessões de sala manuais (Timeline type = SESSAO_SALA, amount = minutos)
  const salaEntries = await prisma.timeline.findMany({
    where: {
      companyId: { in: ids },
      type:      "SESSAO_SALA",
      createdAt: { gte: monthStart, lte: monthEnd },
    },
    select: { companyId: true, amount: true },
  });

  // Impressões manuais (Timeline type = IMPRESSAO, amount = nº impressões)
  const printEntries = await prisma.timeline.findMany({
    where: {
      companyId: { in: ids },
      type:      "IMPRESSAO",
      createdAt: { gte: monthStart, lte: monthEnd },
    },
    select: { companyId: true, amount: true },
  });

  const salaMap:  Record<string, number> = {};
  const printMap: Record<string, number> = {};

  for (const r of reservations) {
    if (!r.companyId) continue;
    const mins = (new Date(r.endDatetime).getTime() - new Date(r.startDatetime).getTime()) / 60000;
    salaMap[r.companyId] = (salaMap[r.companyId] || 0) + mins;
  }
  for (const e of salaEntries) {
    if (!e.companyId) continue;
    salaMap[e.companyId] = (salaMap[e.companyId] || 0) + (e.amount || 0);
  }
  for (const p of printEntries) {
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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { companyId, type, amount, notes } = await req.json();
  if (!companyId || !type || !amount || amount < 1) {
    return NextResponse.json({ error: "companyId, type e amount obrigatórios" }, { status: 400 });
  }

  const isSala   = type === "SESSAO_SALA";
  const isPrint  = type === "IMPRESSAO";
  if (!isSala && !isPrint) {
    return NextResponse.json({ error: "type inválido" }, { status: 400 });
  }

  const title = isSala
    ? `Sessão sala: ${amount >= 60 ? `${Math.floor(amount/60)}h${amount%60>0?` ${amount%60}min`:""}` : `${amount}min`}`
    : `${amount} impressão(ões) registada(s)`;

  const entry = await prisma.timeline.create({
    data: {
      companyId,
      type,
      title,
      description: notes || null,
      amount,
      createdBy:   session.name || session.email,
    },
  });

  return NextResponse.json({ ok: true, entry });
}
