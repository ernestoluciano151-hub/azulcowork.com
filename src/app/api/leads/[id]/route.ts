import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { publish } from "@/lib/event-bus";
import "@/lib/bootstrap";

// PATCH /api/leads/:id -> editar estado, dados ou adicionar nota
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const body = await req.json();
  const {
    firstName, lastName, email, whatsapp, scheduledDate, status, newNote,
    appointmentTime, appointmentType, company
  } = body;

  // Buscar estado anterior para detectar conversão
  const previous = await prisma.lead.findUnique({ where: { id: params.id } });

  const data: any = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (email !== undefined) data.email = email;
  if (whatsapp !== undefined) data.whatsapp = whatsapp;
  if (scheduledDate !== undefined) data.scheduledDate = new Date(scheduledDate);
  if (status !== undefined) data.status = status;
  if (appointmentTime !== undefined) data.appointmentTime = appointmentTime;
  if (appointmentType !== undefined) data.appointmentType = appointmentType;
  if (company !== undefined) data.company = company;

  if (newNote && String(newNote).trim()) {
    data.notes = { create: { content: String(newNote).trim() } };
  }

  const lead = await prisma.lead.update({
    where: { id: params.id },
    data,
    include: { notes: { orderBy: { createdAt: "desc" } } }
  });

  // Emitir evento de atualização
  await publish("lead.updated", {
    leadId: lead.id,
    changes: data,
    updatedBy: session.email,
  });

  // Emitir evento de conversão se status mudou para CONVERTIDO
  if (status === "CONVERTIDO" && previous?.status !== "CONVERTIDO") {
    await publish("lead.converted", {
      leadId: lead.id,
      convertedBy: session.email,
      convertedAt: new Date(),
    });
  }

  return NextResponse.json({ lead });
}

// DELETE /api/leads/:id -> remover lead (uso administrativo)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  await prisma.lead.delete({ where: { id: params.id } });

  await publish("lead.deleted", {
    leadId: params.id,
    deletedBy: session.email,
  });

  return NextResponse.json({ ok: true });
}
