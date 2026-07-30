/**
 * erp-alerts-service.test.ts — Testes unitários do serviço de alertas ERP
 *
 * Testa lógica pura sem BD:
 *  - Escalação de severidade PAYMENT_OVERDUE (WARNING vs CRITICAL)
 *  - Janelas CONTRACT_EXPIRING (60/30/7 dias → INFO/WARNING/CRITICAL)
 *  - Threshold BUDGET_EXCEEDED (15% → WARNING, 30% → CRITICAL)
 *  - Ciclo de vida do alerta (ACTIVE → ACKNOWLEDGED → RESOLVED)
 *  - Validação de snooze (1–90 dias)
 *  - Lógica de depósito em atraso (15 dias após criação)
 */

import { describe, it, expect } from "vitest";

// ── Severidade PAYMENT_OVERDUE ────────────────────────────────────────────────

const OVERDUE_CRITICAL_DAYS = 30;

function paymentOverdueSeverity(daysLate: number): "WARNING" | "CRITICAL" {
  return daysLate >= OVERDUE_CRITICAL_DAYS ? "CRITICAL" : "WARNING";
}

describe("PAYMENT_OVERDUE — escalação de severidade", () => {
  it("1 dia em atraso → WARNING", () => {
    expect(paymentOverdueSeverity(1)).toBe("WARNING");
  });

  it("29 dias em atraso → WARNING", () => {
    expect(paymentOverdueSeverity(29)).toBe("WARNING");
  });

  it("30 dias em atraso → CRITICAL", () => {
    expect(paymentOverdueSeverity(30)).toBe("CRITICAL");
  });

  it("60 dias em atraso → CRITICAL", () => {
    expect(paymentOverdueSeverity(60)).toBe("CRITICAL");
  });

  it("365 dias em atraso → CRITICAL", () => {
    expect(paymentOverdueSeverity(365)).toBe("CRITICAL");
  });

  it("0 dias (venceu hoje) → WARNING", () => {
    expect(paymentOverdueSeverity(0)).toBe("WARNING");
  });
});

// ── Severidade CONTRACT_EXPIRING ──────────────────────────────────────────────

function contractExpiringSeverity(daysLeft: number): "INFO" | "WARNING" | "CRITICAL" {
  if (daysLeft <= 7)  return "CRITICAL";
  if (daysLeft <= 30) return "WARNING";
  return "INFO";
}

describe("CONTRACT_EXPIRING — janelas e severidade", () => {
  it("60 dias restantes → INFO", () => {
    expect(contractExpiringSeverity(60)).toBe("INFO");
  });

  it("31 dias restantes → INFO", () => {
    expect(contractExpiringSeverity(31)).toBe("INFO");
  });

  it("30 dias restantes → WARNING", () => {
    expect(contractExpiringSeverity(30)).toBe("WARNING");
  });

  it("15 dias restantes → WARNING", () => {
    expect(contractExpiringSeverity(15)).toBe("WARNING");
  });

  it("8 dias restantes → WARNING", () => {
    expect(contractExpiringSeverity(8)).toBe("WARNING");
  });

  it("7 dias restantes → CRITICAL", () => {
    expect(contractExpiringSeverity(7)).toBe("CRITICAL");
  });

  it("3 dias restantes → CRITICAL", () => {
    expect(contractExpiringSeverity(3)).toBe("CRITICAL");
  });

  it("1 dia restante → CRITICAL", () => {
    expect(contractExpiringSeverity(1)).toBe("CRITICAL");
  });

  it("0 dias (expira hoje) → CRITICAL", () => {
    expect(contractExpiringSeverity(0)).toBe("CRITICAL");
  });
});

// ── Threshold BUDGET_EXCEEDED ─────────────────────────────────────────────────

const BUDGET_WARNING_PCT  = 1.15;
const BUDGET_CRITICAL_PCT = 1.30;

function budgetSeverity(
  real: number,
  budget: number
): "OK" | "WARNING" | "CRITICAL" {
  if (budget <= 0) return "OK";
  const ratio = real / budget;
  if (ratio >= BUDGET_CRITICAL_PCT) return "CRITICAL";
  if (ratio >= BUDGET_WARNING_PCT)  return "WARNING";
  return "OK";
}

describe("BUDGET_EXCEEDED — thresholds", () => {
  it("dentro do orçamento → OK", () => {
    expect(budgetSeverity(100_000, 100_000)).toBe("OK");  // 100%
    expect(budgetSeverity( 90_000, 100_000)).toBe("OK");  // 90%
    expect(budgetSeverity(114_999, 100_000)).toBe("OK");  // 114.999%
  });

  it("15% acima → WARNING", () => {
    expect(budgetSeverity(115_000, 100_000)).toBe("WARNING");
    expect(budgetSeverity(129_999, 100_000)).toBe("WARNING");
  });

  it("30% acima → CRITICAL", () => {
    expect(budgetSeverity(130_000, 100_000)).toBe("CRITICAL");
    expect(budgetSeverity(200_000, 100_000)).toBe("CRITICAL");
  });

  it("centro sem orçamento (budget=0) → OK (sem alerta)", () => {
    expect(budgetSeverity(50_000, 0)).toBe("OK");
  });

  it("cálculo com orçamento de Kz 400.000 (RH)", () => {
    // Kz 480.000 gasto vs Kz 400.000 orçado = 120% (+20%) → WARNING
    expect(budgetSeverity(480_000, 400_000)).toBe("WARNING");
  });

  it("cálculo com orçamento de Kz 80.000 (Marketing)", () => {
    // Kz 110.000 gasto vs Kz 80.000 orçado = 137.5% (+37.5%) → CRITICAL
    expect(budgetSeverity(110_000, 80_000)).toBe("CRITICAL");
  });
});

// ── Ciclo de vida do alerta ───────────────────────────────────────────────────

type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "SNOOZED";

function canAcknowledge(status: AlertStatus): boolean {
  return status === "ACTIVE";
}

function canResolve(status: AlertStatus): boolean {
  return ["ACTIVE", "ACKNOWLEDGED", "SNOOZED"].includes(status);
}

function canSnooze(status: AlertStatus): boolean {
  return ["ACTIVE", "ACKNOWLEDGED"].includes(status);
}

describe("Ciclo de vida do alerta", () => {
  it("ACTIVE pode ser reconhecido", ()    => expect(canAcknowledge("ACTIVE")).toBe(true));
  it("ACKNOWLEDGED não pode ser re-reconhecido", () => expect(canAcknowledge("ACKNOWLEDGED")).toBe(false));
  it("RESOLVED não pode ser reconhecido", ()  => expect(canAcknowledge("RESOLVED")).toBe(false));

  it("ACTIVE pode ser resolvido",         ()  => expect(canResolve("ACTIVE")).toBe(true));
  it("ACKNOWLEDGED pode ser resolvido",   ()  => expect(canResolve("ACKNOWLEDGED")).toBe(true));
  it("SNOOZED pode ser resolvido",        ()  => expect(canResolve("SNOOZED")).toBe(true));
  it("RESOLVED já está resolvido",        ()  => expect(canResolve("RESOLVED")).toBe(false));

  it("ACTIVE pode ser adiado (snooze)",   ()  => expect(canSnooze("ACTIVE")).toBe(true));
  it("ACKNOWLEDGED pode ser adiado",      ()  => expect(canSnooze("ACKNOWLEDGED")).toBe(true));
  it("SNOOZED não pode ser adiado outra vez", () => expect(canSnooze("SNOOZED")).toBe(false));
  it("RESOLVED não pode ser adiado",      ()  => expect(canSnooze("RESOLVED")).toBe(false));
});

// ── Validação de snooze ───────────────────────────────────────────────────────

function validateSnoozeDays(days: number): boolean {
  return Number.isInteger(days) && days >= 1 && days <= 90;
}

describe("Validação de dias de snooze", () => {
  it("1 dia → válido",   () => expect(validateSnoozeDays(1)).toBe(true));
  it("7 dias → válido",  () => expect(validateSnoozeDays(7)).toBe(true));
  it("90 dias → válido", () => expect(validateSnoozeDays(90)).toBe(true));
  it("0 dias → inválido",  () => expect(validateSnoozeDays(0)).toBe(false));
  it("91 dias → inválido", () => expect(validateSnoozeDays(91)).toBe(false));
  it("decimal → inválido", () => expect(validateSnoozeDays(7.5)).toBe(false));
});

// ── Depósito em atraso ────────────────────────────────────────────────────────

const DEPOSIT_DUE_DAYS = 15;

function isDepositOverdue(contractCreatedAt: Date, today: Date): boolean {
  const diffMs   = today.getTime() - contractCreatedAt.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  return diffDays > DEPOSIT_DUE_DAYS;
}

describe("DEPOSIT_DUE — detecção de caução em atraso", () => {
  const today = new Date("2026-08-15");

  it("contrato criado há 16 dias → caução em atraso", () => {
    const created = new Date("2026-07-30");
    expect(isDepositOverdue(created, today)).toBe(true);
  });

  it("contrato criado há 15 dias exactos → ainda não em atraso", () => {
    const created = new Date("2026-07-31");
    expect(isDepositOverdue(created, today)).toBe(false);
  });

  it("contrato criado há 14 dias → não em atraso", () => {
    const created = new Date("2026-08-01");
    expect(isDepositOverdue(created, today)).toBe(false);
  });

  it("contrato criado há 30 dias → em atraso", () => {
    const created = new Date("2026-07-16");
    expect(isDepositOverdue(created, today)).toBe(true);
  });
});
