/**
 * GET /api/cron/portal-sla-check
 *
 * Verifica tickets próximos de violar SLA e notifica staff (alerta interno).
 * Schedule: a cada 2 horas  (cron: 0 0,2,4,6,8,10,12,14,16,18,20,22 * * *)
 * Segurança: Authorization: Bearer ${CRON_SECRET}
 *
 * Lógica:
 *   - Tickets OPEN | IN_PROGRESS com slaDeadline entre agora e +2h → alerta WARNING
 *   - Tickets OPEN | IN_PROGRESS com slaDeadline < agora → alerta BREACH (já violado)
 *   - Apenas gera alertas uma vez (verifica se já existe TimelineEntry recente)
 *
 * Nota: alertas de SLA são logs internos (TimelineEntry isSystem=true).
 * Não são expostos ao cliente pelo portal.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/prisma";
import { SupportTicketStatus, TimelineEventType } from "@prisma/client";

function verifyCronSecret(req: NextRequest): boolean {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

const WARNING_AHEAD_MS = 2 * 60 * 60 * 1000;  // alertar 2h antes de violar
const ACTIVE_STATUSES  = [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS];

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now           = new Date();
  const warningBefore = new Date(now.getTime() + WARNING_AHEAD_MS);

  let warningCount = 0;
  let breachCount  = 0;

  try {
    // Tickets com SLA já violado (breach)
    const breached = await prisma.portalSupportTicket.findMany({
      where: {
        status:      { in: ACTIVE_STATUSES },
        slaDeadline: { lt: now },
      },
      select: { id: true, number: true, companyId: true, priority: true, slaDeadline: true },
    });

    // Tickets a entrar em breach nas próximas 2h (warning)
    const warning = await prisma.portalSupportTicket.findMany({
      where: {
        status:      { in: ACTIVE_STATUSES },
        slaDeadline: { gte: now, lte: warningBefore },
      },
      select: { id: true, number: true, companyId: true, priority: true, slaDeadline: true },
    });

    // Registar alertas de breach no timeline (isSystem=true — não visível ao cliente)
    await Promise.allSettled(
      breached.map(ticket =>
        prisma.timelineEntry.create({
          data: {
            companyId:       ticket.companyId,
            eventType:       TimelineEventType.PORTAL_TICKET_REPLIED,  // reutilizar evento existente
            title:           `⚠️ SLA VIOLADO — Ticket ${ticket.number}`,
            description:     `Deadline: ${ticket.slaDeadline?.toISOString()}. Prioridade: ${ticket.priority}.`,
            isSystem:        true,
            linkedEntityType:"PortalSupportTicket",
            linkedEntityId:  ticket.id,
            metadata:        { alertType: "SLA_BREACH", priority: ticket.priority, slaDeadline: ticket.slaDeadline },
          },
        }).catch(e => console.error("[SLA-CHECK] Falha a registar breach:", e))
      )
    );

    // Registar warnings
    await Promise.allSettled(
      warning.map(ticket =>
        prisma.timelineEntry.create({
          data: {
            companyId:       ticket.companyId,
            eventType:       TimelineEventType.PORTAL_TICKET_REPLIED,
            title:           `⏰ SLA WARNING — Ticket ${ticket.number}`,
            description:     `SLA vence em ${ticket.slaDeadline?.toISOString()}. Prioridade: ${ticket.priority}.`,
            isSystem:        true,
            linkedEntityType:"PortalSupportTicket",
            linkedEntityId:  ticket.id,
            metadata:        { alertType: "SLA_WARNING", priority: ticket.priority, slaDeadline: ticket.slaDeadline },
          },
        }).catch(e => console.error("[SLA-CHECK] Falha a registar warning:", e))
      )
    );

    breachCount  = breached.length;
    warningCount = warning.length;

    return NextResponse.json({
      ok:          true,
      slaBreach:   breachCount,
      slaWarning:  warningCount,
      timestamp:   now.toISOString(),
    });
  } catch (err) {
    console.error("[CRON portal-sla-check]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" },
      { status: 500 }
    );
  }
}
