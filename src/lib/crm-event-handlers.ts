/**
 * crm-event-handlers.ts — Handlers do Event Bus para o módulo CRM
 *
 * Regras:
 *  - Handlers escrevem na TimelineEntry e CrmAuditLog (append-only)
 *  - Nunca escrevem directamente a dados de negócio
 *  - Todos os erros são capturados e logados sem propagar (fire-and-forget)
 *  - Registo feito via bootstrap.ts — não chamar este ficheiro directamente
 */

import { subscribe } from "@/lib/event-bus";
import { prisma } from "@/lib/prisma";
import { TimelineEventType } from "@prisma/client";

// ── Helper interno ────────────────────────────────────────────────────────────

async function appendTimeline(
  companyId: string,
  eventType: TimelineEventType,
  title: string,
  opts: {
    description?: string;
    actorId?: string;
    actorName?: string;
    isSystem?: boolean;
    linkedEntityType?: string;
    linkedEntityId?: string;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
  } = {}
) {
  try {
    await prisma.timelineEntry.create({
      data: {
        companyId,
        eventType,
        title,
        description:      opts.description,
        actorId:          opts.actorId,
        actorName:        opts.actorName,
        isSystem:         opts.isSystem ?? true,
        linkedEntityType: opts.linkedEntityType,
        linkedEntityId:   opts.linkedEntityId,
        metadata:         opts.metadata ?? {},
        occurredAt:       opts.occurredAt ?? new Date(),
      },
    });
  } catch (err) {
    console.error(`[crm-event-handlers] appendTimeline error (${eventType}):`, err);
  }
}

// ── Registo de handlers ───────────────────────────────────────────────────────

export function registerCrmEventHandlers() {
  // ── Company ──────────────────────────────────────────────────────────────

  subscribe("crm.company.stageChanged", async (payload) => {
    await appendTimeline(
      payload.companyId,
      TimelineEventType.STAGE_CHANGED,
      `Etapa alterada: ${payload.previousStage} → ${payload.newStage}`,
      {
        actorId:  payload.actorId,
        metadata: { previousStage: payload.previousStage, newStage: payload.newStage },
      }
    );
  });

  subscribe("crm.company.statusChanged", async (payload) => {
    await appendTimeline(
      payload.companyId,
      TimelineEventType.COMPANY_STATUS_CHANGED,
      `Estado alterado: ${payload.previousStatus} → ${payload.newStatus}`,
      {
        actorId:  payload.actorId,
        metadata: { previousStatus: payload.previousStatus, newStatus: payload.newStatus },
      }
    );
  });

  subscribe("crm.company.ownerChanged", async (payload) => {
    await appendTimeline(
      payload.companyId,
      TimelineEventType.COMPANY_OWNER_CHANGED,
      `Responsável alterado`,
      {
        actorId:  payload.actorId,
        metadata: { previousOwnerId: payload.previousOwnerId, newOwnerId: payload.newOwnerId },
      }
    );
  });

  subscribe("crm.company.merged", async (payload) => {
    await appendTimeline(
      payload.baseCompanyId,
      TimelineEventType.COMPANY_MERGED,
      `Empresa duplicada "${payload.mergedCompanyName}" fundida nesta empresa`,
      {
        actorId:          payload.actorId,
        linkedEntityType: "Company",
        linkedEntityId:   payload.mergedCompanyId,
        metadata:         { mergedCompanyId: payload.mergedCompanyId, mergedCompanyName: payload.mergedCompanyName },
      }
    );
  });

  // ── Deals ────────────────────────────────────────────────────────────────

  subscribe("crm.deal.created", async (payload) => {
    await appendTimeline(
      payload.companyId,
      TimelineEventType.DEAL_CREATED,
      `Nova oportunidade criada: "${payload.title}"`,
      {
        actorId:          payload.actorId,
        linkedEntityType: "CrmDeal",
        linkedEntityId:   payload.dealId,
        metadata:         { dealId: payload.dealId, title: payload.title, stage: payload.stage, value: payload.value },
      }
    );
  });

  subscribe("crm.deal.stageChanged", async (payload) => {
    await appendTimeline(
      payload.companyId,
      TimelineEventType.DEAL_STAGE_CHANGED,
      `Oportunidade "${payload.title}": ${payload.previousStage} → ${payload.newStage}`,
      {
        actorId:          payload.actorId,
        linkedEntityType: "CrmDeal",
        linkedEntityId:   payload.dealId,
        metadata:         { dealId: payload.dealId, previousStage: payload.previousStage, newStage: payload.newStage },
      }
    );
  });

  subscribe("crm.deal.won", async (payload) => {
    await appendTimeline(
      payload.companyId,
      TimelineEventType.DEAL_WON,
      `Oportunidade ganha: "${payload.title}"${payload.value ? ` — ${payload.currency} ${payload.value.toLocaleString()}` : ""}`,
      {
        actorId:          payload.closedBy,
        linkedEntityType: "CrmDeal",
        linkedEntityId:   payload.dealId,
        metadata:         { dealId: payload.dealId, value: payload.value, currency: payload.currency, cycleTimeDays: payload.cycleTimeDays },
      }
    );
  });

  subscribe("crm.deal.lost", async (payload) => {
    await appendTimeline(
      payload.companyId,
      TimelineEventType.DEAL_LOST,
      `Oportunidade perdida: "${payload.title}" — ${payload.lostReason}`,
      {
        actorId:          payload.actorId,
        linkedEntityType: "CrmDeal",
        linkedEntityId:   payload.dealId,
        metadata:         { dealId: payload.dealId, lostReason: payload.lostReason, value: payload.value },
      }
    );
  });

  // ── Activities ───────────────────────────────────────────────────────────

  subscribe("crm.activity.created", async (payload) => {
    const eventTypeMap: Record<string, TimelineEventType> = {
      CALL_OUTBOUND:     TimelineEventType.CALL_MADE,
      CALL_INBOUND:      TimelineEventType.CALL_RECEIVED,
      EMAIL_OUTBOUND:    TimelineEventType.EMAIL_SENT,
      EMAIL_INBOUND:     TimelineEventType.EMAIL_RECEIVED,
      MEETING_OUTBOUND:  TimelineEventType.MEETING_HELD,
      MEETING_INBOUND:   TimelineEventType.MEETING_HELD,
      VISIT_OUTBOUND:    TimelineEventType.VISIT_DONE,
      DEMO_OUTBOUND:     TimelineEventType.DEMO_DONE,
      WHATSAPP_OUTBOUND: TimelineEventType.WHATSAPP_SENT,
      WHATSAPP_INBOUND:  TimelineEventType.WHATSAPP_RECEIVED,
    };
    const key = `${payload.type}_${payload.direction}`;
    const eventType = eventTypeMap[key] ?? TimelineEventType.CALL_MADE;

    await appendTimeline(
      payload.companyId,
      eventType,
      payload.title,
      {
        actorId:          payload.actorId,
        linkedEntityType: "CrmActivity",
        linkedEntityId:   payload.activityId,
        metadata:         { activityId: payload.activityId, type: payload.type, direction: payload.direction },
      }
    );
  });

  // ── Tasks ────────────────────────────────────────────────────────────────

  subscribe("crm.task.created", async (payload) => {
    await appendTimeline(
      payload.companyId,
      TimelineEventType.TASK_CREATED,
      `Tarefa criada: "${payload.title}"`,
      {
        actorId:          payload.actorId,
        linkedEntityType: "CrmTask",
        linkedEntityId:   payload.taskId,
        metadata:         { taskId: payload.taskId, priority: payload.priority, dueDate: payload.dueDate },
      }
    );
  });

  subscribe("crm.task.completed", async (payload) => {
    await appendTimeline(
      payload.companyId,
      TimelineEventType.TASK_COMPLETED,
      `Tarefa concluída: "${payload.title}"`,
      {
        actorId:          payload.actorId,
        linkedEntityType: "CrmTask",
        linkedEntityId:   payload.taskId,
        metadata:         { taskId: payload.taskId },
      }
    );
  });

  subscribe("crm.task.overdue", async (payload) => {
    await appendTimeline(
      payload.companyId,
      TimelineEventType.TASK_OVERDUE,
      `Tarefa em atraso: "${payload.title}" (${payload.hoursOverdue}h de atraso)`,
      {
        isSystem:         true,
        linkedEntityType: "CrmTask",
        linkedEntityId:   payload.taskId,
        metadata:         { taskId: payload.taskId, dueDate: payload.dueDate, hoursOverdue: payload.hoursOverdue, assignedToId: payload.assignedToId },
      }
    );
  });

  // ── Contactos ────────────────────────────────────────────────────────────

  subscribe("crm.contact.created", async (payload) => {
    await appendTimeline(
      payload.companyId,
      TimelineEventType.CONTACT_ADDED,
      `Contacto adicionado: ${payload.firstName} ${payload.lastName}`,
      {
        actorId:          payload.actorId,
        linkedEntityType: "CrmContact",
        linkedEntityId:   payload.contactId,
        metadata:         { contactId: payload.contactId },
      }
    );
  });

  // ── Eventos externos — Financeiro ────────────────────────────────────────

  subscribe("invoice.created", async (payload) => {
    if (!payload.companyId) return;
    await appendTimeline(
      payload.companyId,
      TimelineEventType.INVOICE_ISSUED,
      `Fatura emitida: ${payload.invoiceNumber} — Kz ${payload.amount.toLocaleString()}`,
      {
        isSystem:         true,
        linkedEntityType: "Invoice",
        linkedEntityId:   payload.invoiceId,
        metadata:         { invoiceId: payload.invoiceId, invoiceNumber: payload.invoiceNumber, amount: payload.amount },
      }
    );
  });

  subscribe("invoice.paid", async (payload) => {
    if (!payload.companyId) return;
    await appendTimeline(
      payload.companyId,
      TimelineEventType.INVOICE_PAID,
      `Fatura paga: ${payload.invoiceNumber} — Kz ${payload.amount.toLocaleString()}`,
      {
        isSystem:         true,
        linkedEntityType: "Invoice",
        linkedEntityId:   payload.invoiceId,
        metadata:         { invoiceId: payload.invoiceId, invoiceNumber: payload.invoiceNumber, amount: payload.amount, paidAt: payload.paidAt },
      }
    );
  });

  subscribe("payment.received", async (payload) => {
    if (!payload.companyId) return;
    await appendTimeline(
      payload.companyId,
      TimelineEventType.PAYMENT_RECEIVED,
      `Pagamento recebido: Kz ${payload.amount.toLocaleString()}`,
      {
        isSystem:         true,
        linkedEntityType: "Payment",
        linkedEntityId:   payload.paymentId,
        metadata:         { paymentId: payload.paymentId, amount: payload.amount, method: payload.method },
      }
    );
  });

  // ── Eventos externos — Coworking ─────────────────────────────────────────

  subscribe("company.created", async (payload) => {
    // Quando uma empresa coworking é criada, registar na Timeline CRM se tiver crmStatus
    const company = await prisma.company.findUnique({
      where: { id: payload.companyId },
      select: { crmStatus: true },
    });
    if (!company?.crmStatus) return;

    await appendTimeline(
      payload.companyId,
      TimelineEventType.CONTRACT_CREATED,
      `Contrato de coworking criado — plano: ${payload.planType}`,
      {
        isSystem: true,
        metadata: { planType: payload.planType },
      }
    );
  });

  // ── Eventos externos — Reservas ──────────────────────────────────────────

  subscribe("reservation.confirmed", async (payload) => {
    if (!payload.companyId) return;
    await appendTimeline(
      payload.companyId,
      TimelineEventType.BOOKING_CONFIRMED,
      `Reserva confirmada: "${payload.eventName}"`,
      {
        isSystem:         true,
        linkedEntityType: "Reservation",
        linkedEntityId:   payload.reservationId,
        metadata:         { reservationId: payload.reservationId, eventName: payload.eventName, startDatetime: payload.startDatetime },
      }
    );
  });

  subscribe("reservation.completed", async (payload) => {
    const reservation = await prisma.reservation.findUnique({
      where: { id: payload.reservationId },
      select: { companyId: true, eventName: true },
    });
    if (!reservation?.companyId) return;

    await appendTimeline(
      reservation.companyId,
      TimelineEventType.BOOKING_COMPLETED,
      `Reserva concluída: "${reservation.eventName}" — Kz ${payload.totalAmount.toLocaleString()}`,
      {
        isSystem:         true,
        linkedEntityType: "Reservation",
        linkedEntityId:   payload.reservationId,
        metadata:         { reservationId: payload.reservationId, totalAmount: payload.totalAmount },
      }
    );
  });

  subscribe("reservation.cancelled", async (payload) => {
    // Localizar companyId via DB
    const reservation = await prisma.reservation.findUnique({
      where: { id: payload.reservationId },
      select: { companyId: true },
    });
    if (!reservation?.companyId) return;

    await appendTimeline(
      reservation.companyId,
      TimelineEventType.BOOKING_CANCELLED,
      `Reserva cancelada: "${payload.eventName}"${payload.reason ? ` — ${payload.reason}` : ""}`,
      {
        isSystem:         true,
        linkedEntityType: "Reservation",
        linkedEntityId:   payload.reservationId,
        metadata:         { reservationId: payload.reservationId, reason: payload.reason },
      }
    );
  });
}
