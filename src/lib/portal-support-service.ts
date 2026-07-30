/**
 * Portal Support Service — Volume 03
 *
 * Ciclo de vida de tickets de suporte ao cliente:
 *  - Criação com numeração ST-YYYY-NNNNNN (atómica)
 *  - Cálculo de SLA em horas úteis WAT (Mon-Fri 08h–18h, Africa/Luanda UTC+1)
 *  - Mensagens: isInternal=true NUNCA visível ao cliente
 *  - Estado: OPEN → IN_PROGRESS → RESOLVED → CLOSED
 *  - Reabertura: só se RESOLVED e dentro de 30 dias
 *  - Timeline obrigatória em cada acção
 *
 * SLA (horas úteis WAT — Mon-Fri 08h-18h):
 *   LOW    → 72h úteis
 *   NORMAL → 48h úteis
 *   HIGH   → 24h úteis
 *   URGENT →  4h úteis
 */

import { prisma }           from "@/lib/prisma";
import { nextDocumentNumber } from "@/lib/document-numbering";
import {
  SupportTicketPriority,
  SupportTicketStatus,
  SupportMessageSender,
  TimelineEventType,
} from "@prisma/client";

// ── SLA ───────────────────────────────────────────────────────────────────────

/** Horas úteis WAT por prioridade */
export const SLA_HOURS: Record<SupportTicketPriority, number> = {
  [SupportTicketPriority.LOW]:    72,
  [SupportTicketPriority.NORMAL]: 48,
  [SupportTicketPriority.HIGH]:   24,
  [SupportTicketPriority.URGENT]:  4,
};

const WAT_OFFSET_HOURS = 1;  // Africa/Luanda = UTC+1
const BUSINESS_START   = 8;  // 08:00 WAT
const BUSINESS_END     = 18; // 18:00 WAT

/**
 * Calcula o deadline de SLA a partir da data de criação,
 * adicionando `hours` horas úteis WAT (Mon-Fri 08h-18h).
 */
export function calculateSlaDeadline(from: Date, hours: number): Date {
  let remaining = hours;
  let current   = new Date(from);

  // Converter para WAT
  const toWAT = (d: Date) => new Date(d.getTime() + WAT_OFFSET_HOURS * 60 * 60 * 1000);
  const fromWAT = (d: Date) => new Date(d.getTime() - WAT_OFFSET_HOURS * 60 * 60 * 1000);

  let watCurrent = toWAT(current);

  // Ajustar para próximo horário de negócio se fora de horas úteis
  function snapToBusinessHours(d: Date): Date {
    const dayOfWeek = d.getUTCDay(); // 0=Dom, 1=Seg, ..., 6=Sáb
    const hour      = d.getUTCHours();

    // Fim de semana → próxima segunda-feira às 08h
    if (dayOfWeek === 0 /* Dom */ ) {
      d = new Date(d);
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCHours(BUSINESS_START, 0, 0, 0);
    } else if (dayOfWeek === 6 /* Sáb */ ) {
      d = new Date(d);
      d.setUTCDate(d.getUTCDate() + 2);
      d.setUTCHours(BUSINESS_START, 0, 0, 0);
    } else if (hour < BUSINESS_START) {
      // Antes das 08h → avançar para 08h
      d = new Date(d);
      d.setUTCHours(BUSINESS_START, 0, 0, 0);
    } else if (hour >= BUSINESS_END) {
      // Depois das 18h → próximo dia útil às 08h
      d = new Date(d);
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCHours(BUSINESS_START, 0, 0, 0);
      return snapToBusinessHours(d);  // recursivo para saltar fim de semana
    }
    return d;
  }

  watCurrent = snapToBusinessHours(watCurrent);

  // Avançar hora a hora
  while (remaining > 0) {
    const dayOfWeek    = watCurrent.getUTCDay();
    const currentHour  = watCurrent.getUTCHours();
    const isBusinessDay = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isBusinessHour = currentHour >= BUSINESS_START && currentHour < BUSINESS_END;

    if (isBusinessDay && isBusinessHour) {
      const hoursUntilEndOfDay = BUSINESS_END - currentHour;
      const hoursToConsume     = Math.min(remaining, hoursUntilEndOfDay);
      watCurrent = new Date(watCurrent.getTime() + hoursToConsume * 60 * 60 * 1000);
      remaining -= hoursToConsume;
    } else {
      // Saltar para próximo horário de negócio
      watCurrent = snapToBusinessHours(watCurrent);
    }
  }

  return fromWAT(watCurrent);
}

// ── Categorias válidas ─────────────────────────────────────────────────────────

export const VALID_TICKET_CATEGORIES = [
  "faturacao",
  "contrato",
  "reservas",
  "tecnico",
  "outro",
] as const;

export type TicketCategory = typeof VALID_TICKET_CATEGORIES[number];

// ── Transições de estado válidas ───────────────────────────────────────────────

const CLOSEABLE_STATUSES: SupportTicketStatus[] = [
  SupportTicketStatus.OPEN,
  SupportTicketStatus.IN_PROGRESS,
  SupportTicketStatus.WAITING,
  SupportTicketStatus.RESOLVED,
];

const REOPENABLE_STATUSES: SupportTicketStatus[] = [
  SupportTicketStatus.RESOLVED,
];

export const REOPEN_DAYS_LIMIT = 30;

export function canCloseTicket(status: SupportTicketStatus): boolean {
  return CLOSEABLE_STATUSES.includes(status);
}

export function canReopenTicket(status: SupportTicketStatus, resolvedAt: Date | null): boolean {
  if (!REOPENABLE_STATUSES.includes(status)) return false;
  if (!resolvedAt) return false;
  const daysSinceResolved = (Date.now() - resolvedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceResolved <= REOPEN_DAYS_LIMIT;
}

// ── Operações principais ───────────────────────────────────────────────────────

/**
 * Cria novo ticket de suporte.
 * Gera número ST-YYYY-NNNNNN de forma atómica.
 * Calcula slaDeadline com base na prioridade.
 */
export async function createSupportTicket(params: {
  companyId:   string;
  createdById: string;
  createdByName: string;
  subject:     string;
  category:    TicketCategory;
  priority:    SupportTicketPriority;
  description: string;
  attachments?: string[];
}): Promise<string> {  // retorna ticketId
  const {
    companyId, createdById, createdByName,
    subject, category, priority, description, attachments,
  } = params;

  const slaDeadline = calculateSlaDeadline(new Date(), SLA_HOURS[priority]);

  const ticket = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx as Parameters<typeof nextDocumentNumber>[0], "ST");

    const t = await tx.portalSupportTicket.create({
      data: {
        number,
        companyId,
        createdById,
        subject,
        category,
        priority,
        status:      SupportTicketStatus.OPEN,
        slaDeadline,
      },
    });

    // Mensagem inicial com a descrição do problema
    await tx.portalSupportMessage.create({
      data: {
        ticketId:    t.id,
        body:        description,
        isInternal:  false,
        senderType:  SupportMessageSender.CLIENT,
        senderId:    createdById,
        senderName:  createdByName,
        attachments: attachments ?? [],
      },
    });

    // Timeline
    await tx.timelineEntry.create({
      data: {
        companyId,
        eventType:       TimelineEventType.PORTAL_TICKET_CREATED,
        title:           `Ticket ${number} criado`,
        description:     `Assunto: ${subject}`,
        actorId:         createdById,
        actorName:       createdByName,
        isSystem:        false,
        linkedEntityType:"PortalSupportTicket",
        linkedEntityId:  t.id,
        metadata: { number, category, priority, slaDeadline },
      },
    });

    return t;
  });

  return ticket.id;
}

/**
 * Adiciona mensagem a um ticket.
 * Se o cliente responde, ticket volta a IN_PROGRESS (de WAITING).
 * isInternal=true: só visível ao staff (validação na camada de route).
 */
export async function addTicketMessage(params: {
  ticketId:    string;
  companyId:   string;
  body:        string;
  senderType:  SupportMessageSender;
  senderId:    string;
  senderName:  string;
  attachments?: string[];
  isInternal?:  boolean;
}): Promise<string> {  // retorna messageId
  const {
    ticketId, companyId, body,
    senderType, senderId, senderName,
    attachments, isInternal,
  } = params;

  // Verificar que ticket existe e pertence à empresa
  const ticket = await prisma.portalSupportTicket.findFirst({
    where: { id: ticketId, companyId },
    select: { id: true, number: true, status: true },
  });
  if (!ticket) throw new Error("TICKET_NOT_FOUND");
  if (ticket.status === SupportTicketStatus.CLOSED) throw new Error("TICKET_CLOSED");

  const result = await prisma.$transaction(async (tx) => {
    const msg = await tx.portalSupportMessage.create({
      data: {
        ticketId,
        body,
        isInternal: isInternal ?? false,
        senderType,
        senderId,
        senderName,
        attachments: attachments ?? [],
      },
    });

    // Actualizar status: se cliente responde e estava WAITING → IN_PROGRESS
    let newStatus: SupportTicketStatus | undefined;
    if (senderType === SupportMessageSender.CLIENT && ticket.status === SupportTicketStatus.WAITING) {
      newStatus = SupportTicketStatus.IN_PROGRESS;
    }

    if (newStatus) {
      await tx.portalSupportTicket.update({
        where: { id: ticketId },
        data:  { status: newStatus },
      });
    }

    await tx.timelineEntry.create({
      data: {
        companyId,
        eventType:       TimelineEventType.PORTAL_TICKET_REPLIED,
        title:           `Resposta ao ticket ${ticket.number}`,
        description:     `Por ${senderName} (${senderType})`,
        actorId:         senderId,
        actorName:       senderName,
        isSystem:        false,
        linkedEntityType:"PortalSupportTicket",
        linkedEntityId:  ticketId,
        metadata:        { senderType, newStatus },
      },
    });

    return msg;
  });

  return result.id;
}

/**
 * Fecha ticket (cliente pode fechar o seu próprio).
 */
export async function closeTicket(params: {
  ticketId:  string;
  companyId: string;
  closedById:  string;
  closedByName: string;
}): Promise<void> {
  const { ticketId, companyId, closedById, closedByName } = params;

  const ticket = await prisma.portalSupportTicket.findFirst({
    where:  { id: ticketId, companyId },
    select: { id: true, number: true, status: true },
  });
  if (!ticket) throw new Error("TICKET_NOT_FOUND");
  if (!canCloseTicket(ticket.status)) throw new Error("TICKET_CANNOT_CLOSE");

  await prisma.$transaction([
    prisma.portalSupportTicket.update({
      where: { id: ticketId },
      data:  { status: SupportTicketStatus.CLOSED, closedAt: new Date() },
    }),
    prisma.timelineEntry.create({
      data: {
        companyId,
        eventType:       TimelineEventType.PORTAL_TICKET_CLOSED,
        title:           `Ticket ${ticket.number} fechado`,
        description:     `Fechado por ${closedByName}`,
        actorId:         closedById,
        actorName:       closedByName,
        isSystem:        false,
        linkedEntityType:"PortalSupportTicket",
        linkedEntityId:  ticketId,
        metadata:        { previousStatus: ticket.status },
      },
    }),
  ]);
}

/**
 * Reabre ticket RESOLVED (dentro de 30 dias).
 */
export async function reopenTicket(params: {
  ticketId:  string;
  companyId: string;
  reopenedById:  string;
  reopenedByName: string;
}): Promise<void> {
  const { ticketId, companyId, reopenedById, reopenedByName } = params;

  const ticket = await prisma.portalSupportTicket.findFirst({
    where:  { id: ticketId, companyId },
    select: { id: true, number: true, status: true, resolvedAt: true },
  });
  if (!ticket) throw new Error("TICKET_NOT_FOUND");
  if (!canReopenTicket(ticket.status, ticket.resolvedAt)) {
    if (ticket.status !== SupportTicketStatus.RESOLVED) {
      throw new Error("TICKET_NOT_RESOLVED");
    }
    throw new Error("TICKET_REOPEN_EXPIRED");
  }

  await prisma.$transaction([
    prisma.portalSupportTicket.update({
      where: { id: ticketId },
      data: {
        status:     SupportTicketStatus.OPEN,
        reopenedAt: new Date(),
        resolvedAt: null,
      },
    }),
    prisma.timelineEntry.create({
      data: {
        companyId,
        eventType:       TimelineEventType.PORTAL_TICKET_REPLIED,
        title:           `Ticket ${ticket.number} reaberto`,
        description:     `Reaberto por ${reopenedByName}`,
        actorId:         reopenedById,
        actorName:       reopenedByName,
        isSystem:        false,
        linkedEntityType:"PortalSupportTicket",
        linkedEntityId:  ticketId,
        metadata:        { reopenedAt: new Date() },
      },
    }),
  ]);
}
