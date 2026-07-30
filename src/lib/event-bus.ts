/**
 * Event Bus central — CRM Azul Coworking
 *
 * Arquitetura de eventos internos baseada em Domain Events.
 * Todos os módulos publicam eventos aqui; qualquer módulo pode subscrever.
 * Elimina acoplamento direto entre módulos (Clean Architecture / DDD).
 *
 * Nota: implementação em memória adequada para Next.js single-instance.
 * Para multi-instância (Vercel Edge / múltiplos pods), substituir por
 * Upstash Redis Pub/Sub mantendo a mesma interface de publish/subscribe.
 */

// ─────────────────────────────────────────────
// 1. TIPOS DE EVENTOS
// ─────────────────────────────────────────────

export type AppEventMap = {
  // ── LEADS ──────────────────────────────────
  "lead.created": {
    leadId: string;
    firstName: string;
    lastName: string;
    email: string;
    source: string;
    createdBy?: string;
  };
  "lead.updated": {
    leadId: string;
    changes: Record<string, unknown>;
    updatedBy?: string;
  };
  "lead.converted": {
    leadId: string;
    companyId?: string;
    convertedBy?: string;
    convertedAt: Date;
  };
  "lead.deleted": {
    leadId: string;
    deletedBy?: string;
  };

  // ── LEADS SALA ─────────────────────────────
  "roomLead.created": {
    roomLeadId: string;
    firstName: string;
    lastName: string;
    email: string;
    planName: string;
  };
  "roomLead.converted": {
    roomLeadId: string;
    companyId: string;
    reservationId?: string;
    convertedBy?: string;
  };
  "roomLead.toReservation": {
    roomLeadId: string;
    reservationId: string;
    createdBy?: string;
  };

  // ── EMPRESAS ───────────────────────────────
  "company.created": {
    companyId: string;
    name: string;
    planType: string;
    createdBy?: string;
  };
  "company.updated": {
    companyId: string;
    changes: Record<string, unknown>;
    updatedBy?: string;
  };
  "company.contractExpiringSoon": {
    companyId: string;
    name: string;
    contractEnd: Date;
    daysLeft: number;
  };
  "company.contractExpired": {
    companyId: string;
    name: string;
    contractEnd: Date;
  };

  // ── COLABORADORES ──────────────────────────
  "employee.created": {
    employeeId: string;
    companyId: string;
    name: string;
    role: string;
  };
  "employee.updated": {
    employeeId: string;
    companyId: string;
    changes: Record<string, unknown>;
  };
  "employee.deleted": {
    employeeId: string;
    companyId: string;
  };

  // ── RESERVAS ───────────────────────────────
  "reservation.created": {
    reservationId: string;
    reservationNumber?: string;
    eventName: string;
    companyId?: string;
    companyName?: string;
    responsible: string;
    startDatetime: Date;
    endDatetime: Date;
    totalAmount: number;
    createdBy?: string;
  };
  "reservation.confirmed": {
    reservationId: string;
    reservationNumber?: string;
    eventName: string;
    companyId?: string;
    responsible: string;
    startDatetime: Date;
  };
  "reservation.cancelled": {
    reservationId: string;
    reservationNumber?: string;
    eventName: string;
    reason?: string;
    cancelledBy?: string;
  };
  "reservation.completed": {
    reservationId: string;
    eventName: string;
    totalAmount: number;
  };
  "reservation.paymentReceived": {
    reservationId: string;
    amount: number;
    method?: string;
    receivedBy?: string;
  };

  // ── PAGAMENTOS ─────────────────────────────
  "payment.created": {
    paymentId: string;
    companyId?: string;
    amount: number;
    dueDate: Date;
    createdBy?: string;
  };
  "payment.received": {
    paymentId: string;
    companyId?: string;
    amount: number;
    method?: string;
    paidDate: Date;
    receivedBy?: string;
  };
  "payment.overdue": {
    paymentId: string;
    companyId?: string;
    amount: number;
    dueDate: Date;
    daysOverdue: number;
  };
  "payment.upcoming": {
    paymentId: string;
    companyId?: string;
    amount: number;
    dueDate: Date;
    daysUntilDue: number;
  };

  // ── DESPESAS ───────────────────────────────
  "expense.created": {
    expenseId: string;
    category: string;
    amount: number;
    description: string;
    createdBy?: string;
  };
  "expense.updated": {
    expenseId: string;
    changes: Record<string, unknown>;
    updatedBy?: string;
  };
  "expense.deleted": {
    expenseId: string;
    amount: number;
    category: string;
  };

  // ── FATURAS ────────────────────────────────
  "invoice.created": {
    invoiceId: string;
    invoiceNumber: string;
    companyId?: string;
    amount: number;
  };
  "invoice.paid": {
    invoiceId: string;
    invoiceNumber: string;
    companyId?: string;
    amount: number;
    paidAt: Date;
  };
  "invoice.overdue": {
    invoiceId: string;
    invoiceNumber: string;
    companyId?: string;
    amount: number;
    dueDate: Date;
  };

  // ── ATIVIDADES / BENEFÍCIOS ────────────────
  "benefit.consumed": {
    companyId: string;
    benefitType: string;
    quantity: number;
    remaining: number;
    limit: number;
  };
  "benefit.nearLimit": {
    companyId: string;
    companyName: string;
    benefitType: string;
    percentUsed: number;
    remaining: number;
  };
  "benefit.exhausted": {
    companyId: string;
    companyName: string;
    benefitType: string;
  };
  "benefit.monthlyReset": {
    month: number;
    year: number;
    companiesReset: number;
  };

  // ── CAMPANHAS / EMAIL ──────────────────────
  "campaign.sent": {
    campaignId: string;
    name: string;
    recipients: number;
    sentAt: Date;
  };
  "campaign.failed": {
    campaignId: string;
    name: string;
    error: string;
  };

  // ── NOTIFICAÇÕES ───────────────────────────
  "notification.created": {
    notificationId: string;
    type: string;
    title: string;
    message: string;
    entityId?: string;
    entityType?: string;
  };

  // ── SISTEMA ────────────────────────────────
  "audit.logged": {
    action: string;
    entityType: string;
    entityId: string;
    userId?: string;
    ip?: string;
    before?: unknown;
    after?: unknown;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CRM — Volume 01 (eventos com prefixo crm.)
  // ═══════════════════════════════════════════════════════════════════════════

  "crm.company.created": {
    companyId: string; name: string; pipelineStage: string;
    assignedToId?: string; actorId?: string; actorName?: string; timestamp: string;
  };
  "crm.company.updated": {
    companyId: string; name: string; changes: Record<string, unknown>;
    actorId?: string; timestamp: string;
  };
  "crm.company.statusChanged": {
    companyId: string; name: string; previousStatus: string; newStatus: string;
    actorId?: string; timestamp: string;
  };
  "crm.company.ownerChanged": {
    companyId: string; name: string; previousOwnerId?: string; newOwnerId: string;
    actorId?: string; timestamp: string;
  };
  "crm.company.merged": {
    baseCompanyId: string; mergedCompanyId: string; mergedCompanyName: string;
    actorId?: string; timestamp: string;
  };
  "crm.company.deleted": {
    companyId: string; name: string; actorId?: string; timestamp: string;
  };
  "crm.company.stageChanged": {
    companyId: string; name: string; previousStage: string; newStage: string;
    actorId?: string; timestamp: string;
  };
  "crm.deal.created": {
    dealId: string; companyId: string; companyName: string; title: string;
    stage: string; value?: number; currency: string; actorId?: string; timestamp: string;
  };
  "crm.deal.stageChanged": {
    dealId: string; companyId: string; title: string; previousStage: string;
    newStage: string; actorId?: string; timestamp: string;
  };
  "crm.deal.won": {
    dealId: string; companyId: string; companyName: string; title: string;
    value?: number; currency: string; closedBy?: string; cycleTimeDays?: number; timestamp: string;
  };
  "crm.deal.lost": {
    dealId: string; companyId: string; companyName: string; title: string;
    lostReason: string; value?: number; actorId?: string; timestamp: string;
  };
  "crm.activity.created": {
    activityId: string; companyId: string; type: string; direction: string;
    title: string; actorId?: string; timestamp: string;
  };
  "crm.task.created": {
    taskId: string; companyId: string; title: string; priority: string;
    dueDate?: string; assignedToId?: string; actorId?: string; timestamp: string;
  };
  "crm.task.completed": {
    taskId: string; companyId: string; title: string; actorId?: string; timestamp: string;
  };
  "crm.task.overdue": {
    taskId: string; companyId: string; title: string; dueDate: string;
    assignedToId?: string; hoursOverdue: number; timestamp: string;
  };
  "crm.contact.created": {
    contactId: string; companyId: string; firstName: string; lastName: string;
    actorId?: string; timestamp: string;
  };
  "crm.contact.updated": {
    contactId: string; companyId: string; changes: Record<string, unknown>;
    actorId?: string; timestamp: string;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ERP — Volume 02 (eventos com prefixo erp.)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Contratos ──────────────────────────────────────────────────────────────
  "erp.contract.created": {
    contractId: string; companyId: string; companyName: string;
    planType: string; monthlyValue: number; actorId: string; timestamp: string;
  };
  "erp.contract.activated": {
    contractId: string; companyId: string; companyName: string;
    schedulesGenerated: number; startDate: string; endDate?: string;
    actorId: string; timestamp: string;
  };
  "erp.contract.suspended": {
    contractId: string; companyId: string; reason?: string;
    actorId: string; timestamp: string;
  };
  "erp.contract.reactivated": {
    contractId: string; companyId: string; actorId: string; timestamp: string;
  };
  "erp.contract.terminated": {
    contractId: string; companyId: string; companyName: string;
    reason?: string; scheduledCancelled: number;
    actorId: string; timestamp: string;
  };
  "erp.contract.expired": {
    contractId: string; companyId: string; endDate: string; timestamp: string;
  };

  // ── Faturas ────────────────────────────────────────────────────────────────
  "erp.invoice.created": {
    invoiceId: string; companyId?: string; type: string;
    total: number; actorId: string; timestamp: string;
  };
  "erp.invoice.issued": {
    invoiceId: string; invoiceNumber: string; companyId?: string;
    type: string; total: number; dueDate: string;
    actorId: string; timestamp: string;
  };
  "erp.invoice.sent": {
    invoiceId: string; invoiceNumber: string; sentTo: string;
    companyId?: string; timestamp: string;
  };
  "erp.invoice.paid": {
    invoiceId: string; invoiceNumber: string; companyId?: string;
    amount: number; paidAt: string; timestamp: string;
  };
  "erp.invoice.overdue": {
    invoiceId: string; invoiceNumber: string; companyId?: string;
    amount: number; dueDate: string; daysOverdue: number; timestamp: string;
  };
  "erp.invoice.voided": {
    invoiceId: string; invoiceNumber: string; companyId?: string;
    reason: string; actorId: string; timestamp: string;
  };

  // ── Pagamentos ─────────────────────────────────────────────────────────────
  "erp.payment.confirmed": {
    paymentId: string; invoiceId?: string; companyId?: string;
    amount: number; method: string; receiptNumber: string;
    actorId: string; timestamp: string;
  };
  "erp.payment.refunded": {
    paymentId: string; invoiceId?: string; companyId?: string;
    amount: number; actorId: string; timestamp: string;
  };

  // ── Despesas ───────────────────────────────────────────────────────────────
  "erp.expense.created": {
    expenseId: string; category: string; amount: number;
    actorId: string; timestamp: string;
  };
  "erp.expense.approved": {
    expenseId: string; amount: number; actorId: string; timestamp: string;
  };
  "erp.expense.paid": {
    expenseId: string; amount: number; actorId: string; timestamp: string;
  };
  "erp.expense.rejected": {
    expenseId: string; reason: string; actorId: string; timestamp: string;
  };
  "erp.expense.cancelled": {
    expenseId: string; actorId: string; timestamp: string;
  };

  // ── Alertas ────────────────────────────────────────────────────────────────
  "erp.alert.created": {
    alertId: string; type: string; severity: string;
    companyId?: string; message: string; timestamp: string;
  };
  "erp.alert.resolved": {
    alertId: string; type: string; actorId: string; timestamp: string;
  };
};

export type AppEventName = keyof AppEventMap;
export type AppEventPayload<T extends AppEventName> = AppEventMap[T];

type Handler<T extends AppEventName> = (payload: AppEventPayload<T>) => void | Promise<void>;

// ─────────────────────────────────────────────
// 2. IMPLEMENTAÇÃO DO EVENT BUS
// ─────────────────────────────────────────────

class EventBus {
  private handlers: Map<string, Set<Handler<AppEventName>>> = new Map();

  /** Subscreve um handler a um evento */
  on<T extends AppEventName>(event: T, handler: Handler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as Handler<AppEventName>);

    // Retorna função de unsubscribe
    return () => {
      this.handlers.get(event)?.delete(handler as Handler<AppEventName>);
    };
  }

  /** Publica um evento — notifica todos os handlers registados */
  async emit<T extends AppEventName>(event: T, payload: AppEventPayload<T>): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers || handlers.size === 0) return;

    const promises: Promise<void>[] = [];
    for (const handler of handlers) {
      try {
        const result = handler(payload as AppEventPayload<AppEventName>);
        if (result instanceof Promise) {
          promises.push(
            result.catch((err) => {
              console.error(`[EventBus] Handler error on "${event}":`, err);
            })
          );
        }
      } catch (err) {
        console.error(`[EventBus] Sync handler error on "${event}":`, err);
      }
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  /** Remove todos os handlers de um evento (útil em testes) */
  off(event: AppEventName): void {
    this.handlers.delete(event);
  }

  /** Remove todos os handlers registados */
  clear(): void {
    this.handlers.clear();
  }

  /** Lista eventos com handlers activos (debug) */
  listEvents(): string[] {
    return Array.from(this.handlers.entries())
      .filter(([, handlers]) => handlers.size > 0)
      .map(([event]) => event);
  }
}

// ─────────────────────────────────────────────
// 3. SINGLETON GLOBAL
// ─────────────────────────────────────────────

// Garante instância única entre hot-reloads em desenvolvimento
const globalForEventBus = globalThis as unknown as { __eventBus?: EventBus };
export const eventBus = globalForEventBus.__eventBus ?? new EventBus();
if (process.env.NODE_ENV !== "production") {
  globalForEventBus.__eventBus = eventBus;
}

// ─────────────────────────────────────────────
// 4. HELPERS DE CONVENIÊNCIA
// ─────────────────────────────────────────────

/** Publica evento de forma tipada */
export function publish<T extends AppEventName>(event: T, payload: AppEventPayload<T>) {
  return eventBus.emit(event, payload);
}

/** Subscreve evento de forma tipada — retorna unsubscribe fn */
export function subscribe<T extends AppEventName>(event: T, handler: Handler<T>) {
  return eventBus.on(event, handler);
}
