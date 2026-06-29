import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: any = { roomId: params.id, status: "CONFIRMADA" };
  if (from || to) {
    where.startDatetime = {};
    if (from) where.startDatetime.gte = new Date(from);
    if (to) where.startDatetime.lte = new Date(to);
  }

  const reservations = await prisma.reservation.findMany({
    where,
    orderBy: { startDatetime: "asc" },
    include: { company: true }
  });

  return NextResponse.json({ reservations });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const { companyId, eventName, responsible, startDatetime, endDatetime, participants, notes } = body;

  if (!eventName || !responsible || !startDatetime || !endDatetime) {
    return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
  }

  const start = new Date(startDatetime);
  const end = new Date(endDatetime);

  // Conflict detection
  const conflict = await prisma.reservation.findFirst({
    where: {
      roomId: params.id,
      status: "CONFIRMADA",
      AND: [
        { startDatetime: { lt: end } },
        { endDatetime: { gt: start } }
      ]
    }
  });

  if (conflict) {
    return NextResponse.json({ error: "Conflito: já existe uma reserva para este período." }, { status: 409 });
  }

  const reservation = await prisma.reservation.create({
    data: {
      roomId: params.id,
      companyId: companyId || null,
      eventName,
      responsible,
      startDatetime: start,
      endDatetime: end,
      participants: Number(participants) || 1,
      notes: notes || null
    },
    include: { room: true, company: true }
  });

  return NextResponse.json({ reservation }, { status: 201 });
}
