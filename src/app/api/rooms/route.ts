import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const rooms = await prisma.meetingRoom.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { reservations: true } }
    }
  });

  return NextResponse.json({ rooms });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const { name, capacity, status, description } = body;

  if (!name || !capacity) {
    return NextResponse.json({ error: "Nome e capacidade são obrigatórios." }, { status: 400 });
  }

  const room = await prisma.meetingRoom.create({
    data: {
      name,
      capacity: Number(capacity),
      status: status || "DISPONIVEL",
      description: description || null
    }
  });

  return NextResponse.json({ room }, { status: 201 });
}
