/**
 * event-bus.test.ts — Testes unitários do EventBus (src/lib/event-bus.ts)
 *
 * Testa: on, emit, off, clear, publish, subscribe, listEvents
 * O EventBus é um singleton — usamos clear() entre testes para evitar interferências.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventBus, publish, subscribe } from "@/lib/event-bus";

beforeEach(() => {
  // Limpar todos os handlers entre testes
  eventBus.clear();
});

// ─────────────────────────────────────────────
// on / emit
// ─────────────────────────────────────────────
describe("EventBus.on / emit", () => {
  it("handler é chamado quando o evento é emitido", async () => {
    const handler = vi.fn();
    eventBus.on("lead.created", handler);

    await eventBus.emit("lead.created", {
      leadId: "lead-001", firstName: "João", lastName: "Silva",
      email: "joao@test.ao", source: "landing-page",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      leadId: "lead-001",
      email:  "joao@test.ao",
    }));
  });

  it("múltiplos handlers são todos chamados", async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    eventBus.on("company.created", h1);
    eventBus.on("company.created", h2);

    await eventBus.emit("company.created", {
      companyId: "cmp-001", name: "Azul Lda", planType: "MENSAL",
    });

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("evento sem handlers não lança erro", async () => {
    await expect(
      eventBus.emit("payment.overdue", {
        paymentId: "pay-001", amount: 150000,
        dueDate: new Date(), daysOverdue: 3,
      })
    ).resolves.toBeUndefined();
  });

  it("handler assíncrono é aguardado", async () => {
    const results: string[] = [];
    eventBus.on("reservation.created", async () => {
      await new Promise(r => setTimeout(r, 10));
      results.push("async-done");
    });

    await eventBus.emit("reservation.created", {
      reservationId: "res-001", eventName: "Reunião", responsible: "Ana",
      startDatetime: new Date(), endDatetime: new Date(), totalAmount: 75000,
    });

    expect(results).toContain("async-done");
  });

  it("erro num handler não bloqueia os outros handlers", async () => {
    const good = vi.fn();
    const bad  = vi.fn().mockImplementation(() => { throw new Error("handler error"); });

    eventBus.on("lead.updated", bad);
    eventBus.on("lead.updated", good);

    await eventBus.emit("lead.updated", { leadId: "lead-001", changes: {} });

    expect(good).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────
// on retorna unsubscribe
// ─────────────────────────────────────────────
describe("EventBus — unsubscribe", () => {
  it("unsubscribe impede handler de receber eventos futuros", async () => {
    const handler = vi.fn();
    const unsub = eventBus.on("payment.received", handler);

    await eventBus.emit("payment.received", {
      paymentId: "pay-001", amount: 150000,
      paidDate: new Date(), companyId: "cmp-001",
    });
    expect(handler).toHaveBeenCalledTimes(1);

    // Remover subscrição
    unsub();

    await eventBus.emit("payment.received", {
      paymentId: "pay-002", amount: 75000,
      paidDate: new Date(), companyId: "cmp-001",
    });
    expect(handler).toHaveBeenCalledTimes(1); // não chamado novamente
  });
});

// ─────────────────────────────────────────────
// off / clear
// ─────────────────────────────────────────────
describe("EventBus.off / clear", () => {
  it("off remove todos os handlers de um evento", async () => {
    const handler = vi.fn();
    eventBus.on("expense.created", handler);
    eventBus.off("expense.created");

    await eventBus.emit("expense.created", {
      expenseId: "exp-001", category: "AGUA", amount: 5000,
      description: "Água", createdBy: "admin",
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("clear remove todos os handlers de todos os eventos", async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    eventBus.on("lead.created", h1);
    eventBus.on("payment.created", h2);

    eventBus.clear();

    await eventBus.emit("lead.created", {
      leadId: "l-1", firstName: "X", lastName: "Y",
      email: "x@y.ao", source: "test",
    });
    await eventBus.emit("payment.created", {
      paymentId: "p-1", amount: 1000, dueDate: new Date(),
    });

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// listEvents
// ─────────────────────────────────────────────
describe("EventBus.listEvents", () => {
  it("devolve lista vazia quando não há handlers", () => {
    expect(eventBus.listEvents()).toEqual([]);
  });

  it("lista eventos com handlers activos", () => {
    eventBus.on("lead.created", vi.fn());
    eventBus.on("company.created", vi.fn());

    const events = eventBus.listEvents();
    expect(events).toContain("lead.created");
    expect(events).toContain("company.created");
  });
});

// ─────────────────────────────────────────────
// publish / subscribe (helpers de conveniência)
// ─────────────────────────────────────────────
describe("publish / subscribe", () => {
  it("publish emite evento e subscribe recebe", async () => {
    const handler = vi.fn();
    subscribe("invoice.created", handler);

    await publish("invoice.created", {
      invoiceId: "inv-001", invoiceNumber: "FT-SALA-2026-000001",
      amount: 75000,
    });

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      invoiceNumber: "FT-SALA-2026-000001",
    }));
  });
});
