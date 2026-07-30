import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { addTimeline } from "@/lib/timeline";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const lead = await prisma.roomBookingLead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  if (lead.companyId) return NextResponse.json({ error: "Lead já foi convertido.", companyId: lead.companyId }, { status: 400 });

  const body = await req.json();
  const companyName = lead.company || `${lead.firstName} ${lead.lastName}`;
  const today = new Date();
  const oneYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name:             companyName,
        responsible:      `${lead.firstName} ${lead.lastName}`,
        email:            lead.email,
        whatsapp:         lead.whatsapp,
        roomNumber:       body.roomNumber       ?? "A definir",
        planType:         body.planType         ?? lead.planName,
        contractStart:    body.contractStart    ? new Date(body.contractStart) : today,
        contractEnd:      body.contractEnd      ? new Date(body.contractEnd)   : oneYear,
        rentAmount:       body.rentAmount       ?? 0,
        paymentFrequency: body.paymentFrequency ?? "MENSAL",
        contractStatus:   "ATIVO",
        leadSourceId:     lead.id,
        notes:            body.notes || `Convertido de Lead Sala (${lead.planName}) — ${lead.id}`,
      },
    });

    await tx.roomBookingLead.update({
      where: { id: params.id },
      data: {
        status:      "CONVERTIDO",
        companyId:   company.id,
        convertedAt: new Date(),
        convertedBy: session.name || session.email,
      },
    });

    await addTimeline(tx, {
      type:          "LEAD_CONVERTIDO",
      title:         `Lead convertido em cliente — ${companyName}`,
      description:   `Plano: ${lead.planName} | Lead ID: ${lead.id}`,
      companyId:     company.id,
      leadId:        lead.id,
      referenceId:   company.id,
      referenceType: "Company",
      createdBy:     session.name || session.email,
    });

    return company;
  });

  return NextResponse.json({ company: result }, { status: 201 });
}
