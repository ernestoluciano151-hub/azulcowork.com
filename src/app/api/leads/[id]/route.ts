import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// PATCH /api/leads/:id -> editar estado, dados ou adicionar nota
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const { firstName, lastName, email, whatsapp, scheduledDate, status, newNote } = body;

  const data: any = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (email !== undefined) data.email = email;
  if (whatsapp !== undefined) data.whatsapp = whatsapp;
  if (scheduledDate !== undefined) data.scheduledDate = new Date(scheduledDate);
  if (status !== undefined) data.status = status;

  if (newNote && String(newNote).trim()) {
    data.notes = { create: { content: String(newNote).trim() } };
  }

  const lead = await prisma.lead.update({
    where: { id: params.id },
    data,
    include: { notes: { orderBy: { createdAt: "desc" } } }
  });

  return NextResponse.json({ lead });
}

// DELETE /api/leads/:id -> remover lead (uso administrativo)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  await prisma.lead.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
