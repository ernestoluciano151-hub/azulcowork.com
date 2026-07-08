import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { addTimeline } from "@/lib/timeline";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const lead = await prisma.roomBookingLead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });

  const body = await req.json();

  const plan = await prisma.meetingPlan.findUnique({ where: { id: body.planId } });
  if (!plan) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  const start      = new Date(body.startDatetime);
  const end        = new Date(body.endDatetime);
  const totalHours = (end.getTime() - start.getTime()) / 3600000;

  const conflict = await prisma.reservation.findFirst({
    where: {
      status: { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
      AND: [{ startDatetime: { lt: end } }, { endDatetime: { gt: start } }],
    },
  });
  if (conflict) return NextResponse.json({ error: "Conflito com outra reserva neste período." }, { status: 409 });

  const year  = new Date().getFullYear();
  const count = await prisma.reservation.count({ where: { reservationNumber: { startsWith: `RES-${year}-` } } });
  const reservationNumber = `RES-${year}-${String(count + 1).padStart(6, "0")}`;

  const result = await prisma.$transaction(async (tx) => {
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
      type:          "RESERVA_CRIADA",
      title:         `Reserva criada — ${reservation.reservationNumber}`,
      description:   `${plan.name} | ${totalHours.toFixed(1)}h | ${formatDate(start)}`,
      companyId:     lead.companyId || null,
      leadId:        lead.id,
      referenceId:   reservation.id,
      referenceType: "Reservation",
      createdBy:     session.name || session.email,
    });

    return reservation;
  });

  return NextResponse.json({ reservation: result }, { status: 201 });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-PT") + " " + d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
