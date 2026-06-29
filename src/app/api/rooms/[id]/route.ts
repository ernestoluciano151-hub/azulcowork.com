import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const room = await prisma.meetingRoom.findUnique({
    where: { id: params.id },
    include: {
      reservations: {
        where: { status: "CONFIRMADA" },
        orderBy: { startDatetime: "asc" },
        include: { company: true }
      }
    }
  });

  if (!room) return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
  return NextResponse.json({ room });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.capacity !== undefined) data.capacity = Number(body.capacity);
  if (body.status !== undefined) data.status = body.status;
  if (body.description !== undefined) data.description = body.description;

  const room = await prisma.meetingRoom.update({ where: { id: params.id }, data });
  return NextResponse.json({ room });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  await prisma.meetingRoom.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
