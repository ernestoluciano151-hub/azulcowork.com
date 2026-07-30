/**
 * pipeline-state-machine.test.ts
 *
 * Cobertura alvo: ≥ 95% (linhas + branches)
 * Cobre: BR-PIPE-001 a BR-PIPE-008 e todas as transições da state machine.
 *
 * Padrão AAA (Arrange / Act / Assert)
 */

import { describe, it, expect } from "vitest";
import { DealStage } from "@prisma/client";
import {
  validateTransition,
  isTerminalStage,
  isWinningTransition,
  isLosingTransition,
  isReEngagement,
  getAllowedTransitions,
  calcCycleTimeDays,
  type TransitionContext,
} from "@/lib/pipeline-state-machine";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ctx(overrides: Partial<TransitionContext> = {}): TransitionContext {
  return {
    companyId:        "co-001",
    dealId:           "dl-001",
    currentStage:     DealStage.DISCOVERY,
    targetStage:      DealStage.QUALIFICATION,
    negotiationCount: 0,
    actorRole:        "COMERCIAL",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// validateTransition — Transições permitidas (BR-PIPE-001)
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateTransition — transições permitidas", () => {
  it("DISCOVERY → QUALIFICATION", () => {
    expect(validateTransition(ctx({ currentStage: DealStage.DISCOVERY, targetStage: DealStage.QUALIFICATION }))).toEqual({ ok: true });
  });

  it("DISCOVERY → LOST (com lostReason)", () => {
    expect(validateTransition(ctx({ currentStage: DealStage.DISCOVERY, targetStage: DealStage.LOST, lostReason: "Sem orçamento" }))).toEqual({ ok: true });
  });

  it("QUALIFICATION → PROPOSAL", () => {
    expect(validateTransition(ctx({ currentStage: DealStage.QUALIFICATION, targetStage: DealStage.PROPOSAL }))).toEqual({ ok: true });
  });

  it("QUALIFICATION → LOST (com lostReason)", () => {
    expect(validateTransition(ctx({ currentStage: DealStage.QUALIFICATION, targetStage: DealStage.LOST, lostReason: "Concorrente ganhou" }))).toEqual({ ok: true });
  });

  it("PROPOSAL → NEGOTIATION (sem outros em NEGOTIATION)", () => {
    expect(validateTransition(ctx({ currentStage: DealStage.PROPOSAL, targetStage: DealStage.NEGOTIATION, negotiationCount: 0 }))).toEqual({ ok: true });
  });

  it("PROPOSAL → LOST (com lostReason)", () => {
    expect(validateTransition(ctx({ currentStage: DealStage.PROPOSAL, targetStage: DealStage.LOST, lostReason: "Preço alto" }))).toEqual({ ok: true });
  });

  it("NEGOTIATION → WON", () => {
    expect(validateTransition(ctx({ currentStage: DealStage.NEGOTIATION, targetStage: DealStage.WON }))).toEqual({ ok: true });
  });

  it("NEGOTIATION → LOST (com lostReason)", () => {
    expect(validateTransition(ctx({ currentStage: DealStage.NEGOTIATION, targetStage: DealStage.LOST, lostReason: "Cliente desistiu" }))).toEqual({ ok: true });
  });

  it("LOST → DISCOVERY (re-engagement)", () => {
    expect(validateTransition(ctx({ currentStage: DealStage.LOST, targetStage: DealStage.DISCOVERY }))).toEqual({ ok: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateTransition — Transições proibidas (BR-PIPE-001)
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateTransition — transições proibidas (BR-PIPE-001)", () => {
  it("DISCOVERY → PROPOSAL (salto de etapa)", () => {
    const result = validateTransition(ctx({ currentStage: DealStage.DISCOVERY, targetStage: DealStage.PROPOSAL }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(422);
  });

  it("DISCOVERY → NEGOTIATION (salto de etapa)", () => {
    const result = validateTransition(ctx({ currentStage: DealStage.DISCOVERY, targetStage: DealStage.NEGOTIATION }));
    expect(result.ok).toBe(false);
  });

  it("DISCOVERY → WON (salto de etapa)", () => {
    const result = validateTransition(ctx({ currentStage: DealStage.DISCOVERY, targetStage: DealStage.WON }));
    expect(result.ok).toBe(false);
  });

  it("QUALIFICATION → DISCOVERY (retrocesso)", () => {
    const result = validateTransition(ctx({ currentStage: DealStage.QUALIFICATION, targetStage: DealStage.DISCOVERY }));
    expect(result.ok).toBe(false);
  });

  it("QUALIFICATION → NEGOTIATION (salto de etapa)", () => {
    const result = validateTransition(ctx({ currentStage: DealStage.QUALIFICATION, targetStage: DealStage.NEGOTIATION }));
    expect(result.ok).toBe(false);
  });

  it("PROPOSAL → QUALIFICATION (retrocesso)", () => {
    const result = validateTransition(ctx({ currentStage: DealStage.PROPOSAL, targetStage: DealStage.QUALIFICATION }));
    expect(result.ok).toBe(false);
  });

  it("PROPOSAL → WON (salto de etapa)", () => {
    const result = validateTransition(ctx({ currentStage: DealStage.PROPOSAL, targetStage: DealStage.WON }));
    expect(result.ok).toBe(false);
  });

  it("WON → qualquer stage (estado terminal)", () => {
    for (const target of [DealStage.LOST, DealStage.NEGOTIATION, DealStage.PROPOSAL, DealStage.DISCOVERY]) {
      const result = validateTransition(ctx({ currentStage: DealStage.WON, targetStage: target }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("nenhuma");
    }
  });

  it("LOST → QUALIFICATION (re-engagement só permite DISCOVERY)", () => {
    const result = validateTransition(ctx({ currentStage: DealStage.LOST, targetStage: DealStage.QUALIFICATION }));
    expect(result.ok).toBe(false);
  });

  it("LOST → WON (proibido)", () => {
    const result = validateTransition(ctx({ currentStage: DealStage.LOST, targetStage: DealStage.WON }));
    expect(result.ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BR-PIPE-007 — LOST exige lostReason
// ═══════════════════════════════════════════════════════════════════════════════

describe("BR-PIPE-007 — LOST exige lostReason", () => {
  it("rejeita → LOST sem lostReason", () => {
    const result = validateTransition(ctx({
      currentStage: DealStage.NEGOTIATION,
      targetStage:  DealStage.LOST,
      lostReason:   undefined,
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("lostReason");
    }
  });

  it("rejeita → LOST com lostReason vazio", () => {
    const result = validateTransition(ctx({
      currentStage: DealStage.NEGOTIATION,
      targetStage:  DealStage.LOST,
      lostReason:   "   ",
    }));
    expect(result.ok).toBe(false);
  });

  it("aceita → LOST com lostReason preenchido", () => {
    const result = validateTransition(ctx({
      currentStage: DealStage.NEGOTIATION,
      targetStage:  DealStage.LOST,
      lostReason:   "Cliente escolheu concorrente",
    }));
    expect(result.ok).toBe(true);
  });

  it("não exige lostReason para outras transições", () => {
    const result = validateTransition(ctx({
      currentStage: DealStage.DISCOVERY,
      targetStage:  DealStage.QUALIFICATION,
      lostReason:   undefined,
    }));
    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BR-PIPE-005 — Máx. 1 deal em NEGOTIATION por empresa
// ═══════════════════════════════════════════════════════════════════════════════

describe("BR-PIPE-005 — máximo 1 deal em NEGOTIATION por empresa", () => {
  it("rejeita → NEGOTIATION se já existe 1 deal em NEGOTIATION", () => {
    const result = validateTransition(ctx({
      currentStage:     DealStage.PROPOSAL,
      targetStage:      DealStage.NEGOTIATION,
      negotiationCount: 1,
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("NEGOTIATION");
    }
  });

  it("rejeita → NEGOTIATION se existem 2 deals em NEGOTIATION", () => {
    const result = validateTransition(ctx({
      currentStage:     DealStage.PROPOSAL,
      targetStage:      DealStage.NEGOTIATION,
      negotiationCount: 2,
    }));
    expect(result.ok).toBe(false);
  });

  it("permite → NEGOTIATION se não existe nenhum deal em NEGOTIATION", () => {
    const result = validateTransition(ctx({
      currentStage:     DealStage.PROPOSAL,
      targetStage:      DealStage.NEGOTIATION,
      negotiationCount: 0,
    }));
    expect(result.ok).toBe(true);
  });

  it("BR-PIPE-005 não se aplica a outras transições", () => {
    const result = validateTransition(ctx({
      currentStage:     DealStage.DISCOVERY,
      targetStage:      DealStage.QUALIFICATION,
      negotiationCount: 5, // irrelevante aqui
    }));
    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BR-PIPE-006 — Desconto > 10% exige approvedBy
// ═══════════════════════════════════════════════════════════════════════════════

describe("BR-PIPE-006 — desconto > 10% exige approvedBy", () => {
  it("rejeita desconto 15% sem approvedBy", () => {
    const result = validateTransition(ctx({ discountPct: 15, approvedBy: undefined }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("10%");
    }
  });

  it("rejeita desconto 10.1% sem approvedBy", () => {
    const result = validateTransition(ctx({ discountPct: 10.1, approvedBy: undefined }));
    expect(result.ok).toBe(false);
  });

  it("permite desconto 10% sem approvedBy (limite exacto não é bloqueado)", () => {
    const result = validateTransition(ctx({ discountPct: 10, approvedBy: undefined }));
    expect(result.ok).toBe(true);
  });

  it("permite desconto 9.9% sem approvedBy", () => {
    const result = validateTransition(ctx({ discountPct: 9.9, approvedBy: undefined }));
    expect(result.ok).toBe(true);
  });

  it("permite desconto 15% com approvedBy preenchido", () => {
    const result = validateTransition(ctx({ discountPct: 15, approvedBy: "admin-001" }));
    expect(result.ok).toBe(true);
  });

  it("permite desconto 0% sem approvedBy", () => {
    const result = validateTransition(ctx({ discountPct: 0, approvedBy: undefined }));
    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

describe("isTerminalStage", () => {
  it("WON é terminal", () => expect(isTerminalStage(DealStage.WON)).toBe(true));
  it("LOST não é terminal absoluto (permite re-engagement)", () => expect(isTerminalStage(DealStage.LOST)).toBe(false));
  it("DISCOVERY não é terminal", () => expect(isTerminalStage(DealStage.DISCOVERY)).toBe(false));
  it("NEGOTIATION não é terminal", () => expect(isTerminalStage(DealStage.NEGOTIATION)).toBe(false));
});

describe("isWinningTransition", () => {
  it("NEGOTIATION → WON é winning", () => expect(isWinningTransition(DealStage.NEGOTIATION, DealStage.WON)).toBe(true));
  it("PROPOSAL → WON não é winning (transição inválida de qualquer forma)", () => expect(isWinningTransition(DealStage.PROPOSAL, DealStage.WON)).toBe(false));
  it("NEGOTIATION → LOST não é winning", () => expect(isWinningTransition(DealStage.NEGOTIATION, DealStage.LOST)).toBe(false));
  it("DISCOVERY → QUALIFICATION não é winning", () => expect(isWinningTransition(DealStage.DISCOVERY, DealStage.QUALIFICATION)).toBe(false));
});

describe("isLosingTransition", () => {
  it("qualquer → LOST é losing", () => {
    expect(isLosingTransition(DealStage.NEGOTIATION, DealStage.LOST)).toBe(true);
    expect(isLosingTransition(DealStage.DISCOVERY, DealStage.LOST)).toBe(true);
    expect(isLosingTransition(DealStage.PROPOSAL, DealStage.LOST)).toBe(true);
  });
  it("→ WON não é losing", () => expect(isLosingTransition(DealStage.NEGOTIATION, DealStage.WON)).toBe(false));
  it("→ QUALIFICATION não é losing", () => expect(isLosingTransition(DealStage.DISCOVERY, DealStage.QUALIFICATION)).toBe(false));
});

describe("isReEngagement", () => {
  it("LOST → DISCOVERY é re-engagement", () => expect(isReEngagement(DealStage.LOST, DealStage.DISCOVERY)).toBe(true));
  it("LOST → QUALIFICATION não é re-engagement", () => expect(isReEngagement(DealStage.LOST, DealStage.QUALIFICATION)).toBe(false));
  it("DISCOVERY → DISCOVERY não é re-engagement", () => expect(isReEngagement(DealStage.DISCOVERY, DealStage.DISCOVERY)).toBe(false));
  it("WON → DISCOVERY não é re-engagement", () => expect(isReEngagement(DealStage.WON, DealStage.DISCOVERY)).toBe(false));
});

describe("getAllowedTransitions", () => {
  it("DISCOVERY permite QUALIFICATION e LOST", () => {
    const transitions = getAllowedTransitions(DealStage.DISCOVERY);
    expect(transitions).toContain(DealStage.QUALIFICATION);
    expect(transitions).toContain(DealStage.LOST);
    expect(transitions).not.toContain(DealStage.NEGOTIATION);
  });

  it("NEGOTIATION permite WON e LOST", () => {
    const transitions = getAllowedTransitions(DealStage.NEGOTIATION);
    expect(transitions).toContain(DealStage.WON);
    expect(transitions).toContain(DealStage.LOST);
    expect(transitions.length).toBe(2);
  });

  it("WON retorna array vazio", () => {
    expect(getAllowedTransitions(DealStage.WON)).toHaveLength(0);
  });

  it("LOST permite apenas DISCOVERY (re-engagement)", () => {
    const transitions = getAllowedTransitions(DealStage.LOST);
    expect(transitions).toEqual([DealStage.DISCOVERY]);
  });

  it("retorna nova cópia do array (imutabilidade)", () => {
    const a = getAllowedTransitions(DealStage.DISCOVERY);
    const b = getAllowedTransitions(DealStage.DISCOVERY);
    expect(a).not.toBe(b);
  });
});

describe("calcCycleTimeDays", () => {
  it("deal criado hoje e fechado hoje = 0 dias", () => {
    const now = new Date();
    expect(calcCycleTimeDays(now, now)).toBe(0);
  });

  it("deal criado há 30 dias = 30 dias", () => {
    const created  = new Date("2026-06-01");
    const closedAt = new Date("2026-07-01");
    expect(calcCycleTimeDays(created, closedAt)).toBe(30);
  });

  it("deal criado há 1 dia = 1 dia", () => {
    const created  = new Date("2026-07-27");
    const closedAt = new Date("2026-07-28");
    expect(calcCycleTimeDays(created, closedAt)).toBe(1);
  });

  it("deal criado há 90 dias = 90 dias", () => {
    const created  = new Date("2026-04-29");
    const closedAt = new Date("2026-07-28");
    expect(calcCycleTimeDays(created, closedAt)).toBe(90);
  });
});
