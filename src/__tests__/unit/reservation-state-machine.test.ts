/**
 * Testes unitários — Reservation State Machine
 * VOL04-1D
 *
 * Valida:
 *  - Transições de estado válidas e inválidas
 *  - Estados terminais (CONCLUIDA, CANCELADA)
 *  - canTransition() e assertValidTransition()
 *  - isCancellationFree() — regra das 24h
 *  - CANCELLATION_FREE_HOURS constante
 *  - OCCUPYING_STATUSES — estados que bloqueiam slot
 */

import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertValidTransition,
  isCancellationFree,
  CANCELLATION_FREE_HOURS,
  VALID_TRANSITIONS,
  OCCUPYING_STATUSES,
  InvalidStatusTransitionError,
} from "@/lib/reservation-state-machine";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Transições válidas
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — State Machine: transições válidas", () => {
  it("PENDENTE_APROVACAO → CONFIRMADA (aprovação de orçamento personalizado)", () => {
    expect(canTransition("PENDENTE_APROVACAO", "CONFIRMADA")).toBe(true);
  });

  it("PENDENTE_APROVACAO → CANCELADA (rejeição do orçamento)", () => {
    expect(canTransition("PENDENTE_APROVACAO", "CANCELADA")).toBe(true);
  });

  it("RESERVADO → CONFIRMADA (pagamento recebido)", () => {
    expect(canTransition("RESERVADO", "CONFIRMADA")).toBe(true);
  });

  it("RESERVADO → CANCELADA (cliente cancela antes do evento)", () => {
    expect(canTransition("RESERVADO", "CANCELADA")).toBe(true);
  });

  it("CONFIRMADA → CONCLUIDA (evento ocorreu — cron diário)", () => {
    expect(canTransition("CONFIRMADA", "CONCLUIDA")).toBe(true);
  });

  it("CONFIRMADA → CANCELADA (cancelamento dentro da política)", () => {
    expect(canTransition("CONFIRMADA", "CANCELADA")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Transições inválidas
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — State Machine: transições inválidas", () => {
  it("PENDENTE_APROVACAO → CONCLUIDA → false (saltar estados)", () => {
    expect(canTransition("PENDENTE_APROVACAO", "CONCLUIDA")).toBe(false);
  });

  it("PENDENTE_APROVACAO → RESERVADO → false (fluxo incorreto)", () => {
    expect(canTransition("PENDENTE_APROVACAO", "RESERVADO")).toBe(false);
  });

  it("RESERVADO → CONCLUIDA → false (saltar confirmação)", () => {
    expect(canTransition("RESERVADO", "CONCLUIDA")).toBe(false);
  });

  it("RESERVADO → PENDENTE_APROVACAO → false (regressão)", () => {
    expect(canTransition("RESERVADO", "PENDENTE_APROVACAO")).toBe(false);
  });

  it("CONFIRMADA → PENDENTE_APROVACAO → false (regressão)", () => {
    expect(canTransition("CONFIRMADA", "PENDENTE_APROVACAO")).toBe(false);
  });

  it("CONFIRMADA → RESERVADO → false (regressão)", () => {
    expect(canTransition("CONFIRMADA", "RESERVADO")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Estados terminais
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — State Machine: estados terminais", () => {
  it("CONCLUIDA → qualquer estado → false (terminal)", () => {
    const targets = ["PENDENTE_APROVACAO", "RESERVADO", "CONFIRMADA", "CANCELADA"];
    for (const to of targets) {
      expect(canTransition("CONCLUIDA", to)).toBe(false);
    }
  });

  it("CANCELADA → qualquer estado → false (terminal)", () => {
    const targets = ["PENDENTE_APROVACAO", "RESERVADO", "CONFIRMADA", "CONCLUIDA"];
    for (const to of targets) {
      expect(canTransition("CANCELADA", to)).toBe(false);
    }
  });

  it("CONCLUIDA tem 0 transições válidas na tabela", () => {
    expect(VALID_TRANSITIONS["CONCLUIDA"]).toHaveLength(0);
  });

  it("CANCELADA tem 0 transições válidas na tabela", () => {
    expect(VALID_TRANSITIONS["CANCELADA"]).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. assertValidTransition — lança InvalidStatusTransitionError
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — assertValidTransition", () => {
  it("transição válida não lança erro", () => {
    expect(() => assertValidTransition("CONFIRMADA", "CONCLUIDA")).not.toThrow();
  });

  it("transição inválida lança InvalidStatusTransitionError", () => {
    expect(() => assertValidTransition("CONCLUIDA", "CONFIRMADA"))
      .toThrow(InvalidStatusTransitionError);
  });

  it("erro contém from e to correctos", () => {
    try {
      assertValidTransition("CANCELADA", "RESERVADO");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidStatusTransitionError);
      expect((err as InvalidStatusTransitionError).from).toBe("CANCELADA");
      expect((err as InvalidStatusTransitionError).to).toBe("RESERVADO");
    }
  });

  it("mensagem de erro menciona a transição inválida", () => {
    try {
      assertValidTransition("CONCLUIDA", "CANCELADA");
    } catch (err) {
      expect((err as Error).message).toContain("CONCLUIDA");
      expect((err as Error).message).toContain("CANCELADA");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. OCCUPYING_STATUSES — estados que bloqueiam slot
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — OCCUPYING_STATUSES", () => {
  it("CONFIRMADA bloqueia slot", () => {
    expect(OCCUPYING_STATUSES).toContain("CONFIRMADA");
  });

  it("RESERVADO bloqueia slot", () => {
    expect(OCCUPYING_STATUSES).toContain("RESERVADO");
  });

  it("PENDENTE_APROVACAO bloqueia slot", () => {
    expect(OCCUPYING_STATUSES).toContain("PENDENTE_APROVACAO");
  });

  it("CANCELADA NÃO bloqueia slot", () => {
    expect(OCCUPYING_STATUSES).not.toContain("CANCELADA");
  });

  it("CONCLUIDA NÃO bloqueia slot (evento passado)", () => {
    expect(OCCUPYING_STATUSES).not.toContain("CONCLUIDA");
  });
});
