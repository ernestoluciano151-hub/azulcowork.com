/**
 * GET    /api/portal/bookings/[id]  — detalhe de reserva
 * DELETE /api/portal/bookings/[id]  — cancelar reserva (mín. 24h de antecedência)
 *
 * Regra BR-PORT-007: conflict check igual ao sistema legado.
 * Regra de cancelamento: só permitido com ≥ 24h de antecedência.
 * Isolamento: companyId obrigatório em todas as queries.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession, requirePortalRole } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";
import { PortalRole, TimelineEventType } from "@prisma/client";

const CANCELLABLE_STATUSES = ["PENDENTE_APROVACAO", "RESERVADO", "CONFIRMADA"] as const;
const MIN_CANCEL_HOURS = 24;

// ── GET — detalhe de reserva ───────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { id } = await params;

    const booking = await prisma.reservation.findFirst({
      where: {
        id,
        companyId: user.companyId,  // isolamento multi-tenant
      },
      select: {
        id:                true,
        reservationNumber: true,
        eventName:         true,
        status:            true,
        startDatetime:     true,
        endDatetime:       true,
        totalHours:        true,
        participants:      true,
        coffeeBreak:       true,
        paymentStatus:     true,
        paymentOption:     true,
        amount:            true,
        totalAmount:       true,
        observations:      true,
        createdAt:         true,
        plan: {
          select: {
            id:          true,
            name:        true,
            maxPeople:   true,
            pricePerHour:true,
          },
        },
        invoices: {
          select: {
            id:     true,
            number: true,
            status: true,
            total:  true,
          },
          take: 5,
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    // Indicar se pode ser cancelado
    const canCancel = CANCELLABLE_STATUSES.includes(booking.status as typeof CANCELLABLE_STATUSES[number])
      && booking.startDatetime.getTime() - Date.now() >= MIN_CANCEL_HOURS * 60 * 60 * 1000;

    return NextResponse.json({ data: { ...booking, canCancel } });
  } catch (err) {
    console.error("[GET /api/portal/bookings/[id]]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}

// ── DELETE — cancelar reserva ──────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_MEMBER);
    if (error) return error;

    const { id } = await params;

    const booking = await prisma.reservation.findFirst({
      where: {
        id,
        companyId: user.companyId,  // isolamento multi-tenant
      },
      select: {
        id:                true,
        reservationNumber: true,
        eventName:         true,
        status:            true,
        startDatetime:     true,
        totalAmount:       true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    // Verificar se o status permite cancelamento
    if (!CANCELLABLE_STATUSES.includes(booking.status as typeof CANCELLABLE_STATUSES[number])) {
      return NextResponse.json(
        { error: `Não é possível cancelar uma reserva com estado "${booking.status}".` },
        { status: 409 }
      );
    }

    // Verificar regra das 24h
    const hoursUntilStart = (booking.startDatetime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilStart < MIN_CANCEL_HOURS) {
      return NextResponse.json(
        {
          error: `Não é possível cancelar com menos de ${MIN_CANCEL_HOURS}h de antecedência. `
            + `A sua reserva começa em ${Math.floor(hoursUntilStart)}h.`,
        },
        { status: 409 }
      );
    }

    // Cancelar em transacção (actualizar + criar timeline)
    await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data:  { status: "CANCELADA" },
      }),
      prisma.timelineEntry.create({
        data: {
          companyId:       user.companyId,
          eventType:       TimelineEventType.BOOKING_CANCELLED,
          title:           `Reserva ${booking.reservationNumber ?? id} cancelada`,
          description:     `Cancelada pelo utilizador ${user.name} (${user.email}) via portal`,
          actorId:         user.sub,
          actorName:       user.name,
          isSystem:        false,
          linkedEntityType:"Reservation",
          linkedEntityId:  booking.id,
          metadata: {
            eventName:    booking.eventName,
            startDatetime:booking.startDatetime,
            totalAmount:  booking.totalAmount,
            portalUserId: user.sub,
          },
        },
      }),
    ]);

    return NextResponse.json({
      ok:      true,
      message: "Reserva cancelada com sucesso.",
    });
  } catch (err) {
    console.error("[DELETE /api/portal/bookings/[id]]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
