import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole, Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { addTimeline } from "@/lib/timeline";
import { nextDocumentNumber } from "@/lib/document-numbering";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const lead = await prisma.roomBookingLead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });

  const body = await req.json();

  const plan = await prisma.meetingPlan.findUnique({ where: { id: body.planId } });
  if (!plan) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  const start      = new Date(body.startDatetime);
  const end        = new Date(body.endDatetime);
  const totalHours = (end.getTime() - start.getTime()) / 3600000;

  let result: Awaited<ReturnType<typeof runTx>>;
  try {
    result = await runTx();
  } catch (e) {
    if (e instanceof ReservationConflictError) {
      return NextResponse.json({ error: "Conflito com outra reserva neste período." }, { status: 409 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      return NextResponse.json({ error: "Conflito de concorrência. Tente novamente." }, { status: 409 });
    }
    // 15 Set 2026: antes, qualquer outro erro (ex.: a violação de FK
    // corrigida abaixo em addTimeline) propagava sem tratamento —
    // Next.js devolvia um 500 sem JSON estruturado, o frontend caía no
    // fallback genérico, e sem Sentry.captureException o erro real nunca
    // era visível. Ver mesma correcção em .../convert/route.ts.
    console.error("[POST /api/room-booking-leads/[id]/to-reservation]", e);
    Sentry.captureException(e, {
      tags:  { route: "room-booking-leads/[id]/to-reservation" },
      extra: { leadId: params.id },
    });
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Erro ao criar reserva: ${msg}` }, { status: 500 });
  }

  async function runTx() {
    return prisma.$transaction(async (tx) => {
      // ── Conflict check DENTRO da transacção serializable ─────────────────────
      const conflict = await tx.reservation.findFirst({
        where: {
          status: { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
          AND: [{ startDatetime: { lt: end } }, { endDatetime: { gt: start } }],
        },
      });
      if (conflict) throw new ReservationConflictError();

      // ── Numeração DENTRO da transacção (evita race condition) ────────────────
      const reservationNumber = await nextDocumentNumber(tx, "RES");

      const reservation = await tx.reservation.create({
        data: {
          reservationNumber,
          eventName:          body.eventName || `${lead.planName} — ${lead.firstName} ${lead.lastName}`,
          companyName:        lead.company   || null,
          companyId:          lead.companyId || null,
          responsible:        `${lead.firstName} ${lead.lastName}`,
          email:              lead.email,
          whatsapp:           lead.whatsapp,
          planId:             body.planId,
          participants:       lead.participants || Number(body.participants) || 1,
          startDatetime:      start,
          endDatetime:        end,
          totalHours,
          coffeeBreak:        lead.coffeeBreak,
          observations:       lead.observations || null,
          status:             "RESERVADO",
          isCustomPricing:    false,
          paymentOption:      body.paymentOption || "PAGAR_NO_DIA",
          amount:             Number(body.amount)      || 0,
          discount:           Number(body.discount)    || 0,
          iva:                Number(body.iva)         || 0,
          totalAmount:        Number(body.totalAmount) || 0,
          paymentStatus:      "PENDENTE",
          roomBookingLeadId:  lead.id,
        },
        include: { plan: true },
      });

      await tx.roomBookingLead.update({
        where: { id: lead.id },
        data:  { reservationId: reservation.id, status: "RESERVA_CRIADA" },
      });

      await addTimeline(tx, {
        type:        "RESERVA_CRIADA",
        title:       `Reserva criada — ${reservation.reservationNumber}`,
        // 15 Set 2026: NÃO passar `leadId: lead.id` — `lead` é um
        // RoomBookingLead, mas `Timeline.leadId` tem FK real para a tabela
        // `Lead` (CRM), não `RoomBookingLead`. Mesmo bug e mesma correcção
        // que em .../convert/route.ts (ver comentário lá para detalhe).
        description:   `${plan.name} | ${totalHours.toFixed(1)}h | ${formatDate(start)}`,
        companyId:     lead.companyId || null,
        referenceId:   reservation.id,
        referenceType: "Reservation",
        createdBy:     session.name || session.email,
      });

      return reservation;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  return NextResponse.json({ reservation: result }, { status: 201 });
}

class ReservationConflictError extends Error {
  constructor() { super("RESERVATION_CONFLICT"); }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-PT") + " " + d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
