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
