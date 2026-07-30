/**
 * GET /api/cron/portal-auto-close-tickets
 *
 * Fecha automaticamente tickets WAITING há mais de 7 dias sem resposta.
 * Schedule: 0 10 * * * (diário às 10h WAT)
 * Segurança: Authorization: Bearer ${CRON_SECRET}
 *
 * Regra: ticket WAITING com updatedAt há > 7 dias → CLOSED
 * Adiciona mensagem automática explicando o fecho.
 * Regista TimelineEntry (isSystem=true).
 */

import { NextRequest, NextResponse }        from "next/server";
import { prisma }                           from "@/lib/prisma";
import { SupportTicketStatus, TimelineEventType, SupportMessageSender } from "@prisma/client";

function verifyCronSecret(req: NextRequest): boolean {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

const WAITING_DAYS_BEFORE_CLOSE = 7;
const AUTO_CLOSE_MESSAGE = "Este ticket foi fechado automaticamente por inactividade após 7 dias sem resposta. "
  + "Se ainda precisar de ajuda, por favor abra um novo ticket ou reabra este dentro de 30 dias.";

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - WAITING_DAYS_BEFORE_CLOSE * 24 * 60 * 60 * 1000);
  let closed   = 0;

  try {
    const stale = await prisma.portalSupportTicket.findMany({
      where: {
        status:    SupportTicketStatus.WAITING,
        updatedAt: { lt: cutoff },
      },
      select: { id: true, number: true, companyId: true },
      take:   100,
    });

    await Promise.allSettled(
      stale.map(ticket =>
        prisma.$transaction([
          prisma.portalSupportTicket.update({
            where: { id: ticket.id },
            data:  {
              status:   SupportTicketStatus.CLOSED,
              closedAt: new Date(),
            },
          }),
          prisma.portalSupportMessage.create({
            data: {
              ticketId:   ticket.id,
              body:       AUTO_CLOSE_MESSAGE,
              isInternal: false,
              senderType: SupportMessageSender.STAFF,
              senderId:   "system",
              senderName: "Sistema Azul Coworking",
            },
          }),
          prisma.timelineEntry.create({
            data: {
              companyId:       ticket.companyId,
              eventType:       TimelineEventType.PORTAL_TICKET_CLOSED,
              title:           `Ticket ${ticket.number} fechado por inactividade`,
              description:     `Fechado automaticamente após ${WAITING_DAYS_BEFORE_CLOSE} dias em estado WAITING.`,
              isSystem:        true,
              linkedEntityType:"PortalSupportTicket",
              linkedEntityId:  ticket.id,
              metadata:        { reason: "AUTO_CLOSE_INACTIVITY", waitingDays: WAITING_DAYS_BEFORE_CLOSE },
            },
          }),
        ]).then(() => { closed++; })
          .catch(e => console.error(`[AUTO-CLOSE] Falha ticket ${ticket.number}:`, e))
      )
    );

    return NextResponse.json({
      ok:        true,
      closed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[CRON portal-auto-close-tickets]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" },
      { status: 500 }
    );
  }
}
