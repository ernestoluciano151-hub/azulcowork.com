import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const data = await req.json();
  const lead = await prisma.roomBookingLead.update({ where: { id: params.id }, data });
  return NextResponse.json(lead);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  await prisma.roomBookingLead.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
