import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole, CompanyCategory } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { addTimeline } from "@/lib/timeline";
import * as Sentry from "@sentry/nextjs";

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

  // Categoria: por defeito estes leads são clientes eventuais de sala de
  // reunião (SALA_REUNIAO) — pagam por evento, sem mensalidade. O admin
  // pode explicitamente pedir "SALA_PRIVADA" (ex: cliente que afinal quer
  // um espaço/contrato dedicado), mantendo o fluxo actual nesse caso.
  const category: CompanyCategory =
    body.category === "SALA_PRIVADA" ? CompanyCategory.SALA_PRIVADA : CompanyCategory.SALA_REUNIAO;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name:             companyName,
          responsible:      `${lead.firstName} ${lead.lastName}`,
          email:            lead.email,
          whatsapp:         lead.whatsapp,
          category,
          roomNumber:       body.roomNumber       ?? "—",
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
        type:        "LEAD_CONVERTIDO",
        title:       `Lead convertido em cliente — ${companyName}`,
        // 15 Set 2026: NÃO passar `leadId: lead.id` aqui — `lead` é um
        // RoomBookingLead, mas `Timeline.leadId` tem FK real para a tabela
        // `Lead` (CRM), não `RoomBookingLead` (ver migration
        // 20240114000000_employees_notifications_fks). Isto violava a
        // constraint em TODA conversão de lead de sala, revertendo a
        // transacção inteira (nem a Company era criada) e devolvendo um
        // 500 sem JSON estruturado — daí "Erro ao converter." genérico no
        // ecrã, sem detalhe, e sem chegar ao Sentry (sem captureException
        // aqui). O ID do RoomBookingLead já fica registado na descrição
        // abaixo — não se perde informação ao omitir `leadId`.
        description:   `Plano: ${lead.planName} | Lead ID: ${lead.id}`,
        companyId:     company.id,
        referenceId:   company.id,
        referenceType: "Company",
        createdBy:     session.name || session.email,
      });

      return company;
    });

    return NextResponse.json({ company: result }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/room-booking-leads/[id]/convert]", err);
    Sentry.captureException(err, {
      tags:  { route: "room-booking-leads/[id]/convert" },
      extra: { leadId: params.id, category },
    });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao converter lead em cliente: ${msg}` }, { status: 500 });
  }
}
