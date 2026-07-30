/**
 * pipeline-state-machine.ts — Máquina de estados do pipeline CRM
 *
 * Implementa todas as transições permitidas e as regras de negócio associadas.
 * Funções puras (sem side effects) para facilitar testes unitários a ≥ 95%.
 *
 * Regras implementadas:
 *  BR-PIPE-001: Só transições permitidas são aceites
 *  BR-PIPE-002: WON e LOST são estados terminais (sem saída, excepto LOST → re-engagement)
 *  BR-PIPE-005: Máximo 1 deal em NEGOTIATION por empresa
 *  BR-PIPE-006: discountPct > 10 exige approvedBy (ADMIN)
 *  BR-PIPE-007: stage = LOST exige lostReason
 *  BR-PIPE-008: stage = WON actualiza company.crmStatus = ACTIVE
 *
 * Docs: docs/04-crm/pipeline.md · docs/04-crm/testing.md
 */

import { DealStage } from "@prisma/client";

// ── Mapa de transições permitidas ────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<DealStage, DealStage[]> = {
  [DealStage.DISCOVERY]:     [DealStage.QUALIFICATION, DealStage.LOST],
  [DealStage.QUALIFICATION]: [DealStage.PROPOSAL, DealStage.LOST],
  [DealStage.PROPOSAL]:      [DealStage.NEGOTIATION, DealStage.LOST],
  [DealStage.NEGOTIATION]:   [DealStage.WON, DealStage.LOST],
  [DealStage.WON]:           [],           // estado terminal — sem transições permitidas
  [DealStage.LOST]:          [DealStage.DISCOVERY], // re-engagement
};

// ── Tipos ────────────────────────────────────────────────────────────────────

export type TransitionResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export interface TransitionContext {
  /** ID da empresa (para validar BR-PIPE-005) */
  companyId: string;
  /** ID do deal sendo transitado */
  dealId: string;
  /** Stage actual do deal */
  currentStage: DealStage;
  /** Stage pretendido */
  targetStage: DealStage;
  /** Motivo de perda — obrigatório se targetStage = LOST (BR-PIPE-007) */
  lostReason?: string;
  /** Percentagem de desconto — se > 10, approvedBy é obrigatório (BR-PIPE-006) */
  discountPct?: number;
  /** ID do utilizador que aprovou o desconto (ADMIN) */
  approvedBy?: string;
  /** Role do utilizador a fazer a transição */
  actorRole: string;
  /** Número de deals em NEGOTIATION nesta empresa (excluindo este deal) */
  negotiationCount: number;
}

// ── Função principal: validar transição ─────────────────────────────────────

/**
 * Valida se uma transição de stage é permitida e respeita todas as regras de negócio.
 * Não executa nenhuma escrita na base de dados.
 *
 * @returns `{ ok: true }` se a transição é válida,
 *          `{ ok: false, status, error }` caso contrário.
 */
export function validateTransition(ctx: TransitionContext): TransitionResult {
  const { currentStage, targetStage } = ctx;

  // BR-PIPE-001: Verificar se a transição está na lista de permitidas
  const allowed = ALLOWED_TRANSITIONS[currentStage];
  if (!allowed.includes(targetStage)) {
    return {
      ok: false,
      status: 422,
      error: `Transição inválida: ${currentStage} → ${targetStage}. Transições permitidas a partir de ${currentStage}: ${allowed.length > 0 ? allowed.join(", ") : "nenhuma (estado terminal)"}.`,
    };
  }

  // BR-PIPE-007: LOST exige lostReason
  if (targetStage === DealStage.LOST && !ctx.lostReason?.trim()) {
    return {
      ok: false,
      status: 422,
      error: "O motivo de perda (lostReason) é obrigatório ao marcar uma oportunidade como LOST.",
    };
  }

  // BR-PIPE-005: Máximo 1 deal em NEGOTIATION por empresa
  if (targetStage === DealStage.NEGOTIATION && ctx.negotiationCount > 0) {
    return {
      ok: false,
      status: 422,
      error: "Já existe uma oportunidade em NEGOTIATION para esta empresa. Feche a actual antes de avançar outra.",
    };
  }

  // BR-PIPE-006: Desconto > 10% exige aprovação de ADMIN
  if (ctx.discountPct !== undefined && ctx.discountPct > 10 && !ctx.approvedBy) {
    return {
      ok: false,
      status: 422,
      error: "Desconto superior a 10% requer aprovação de um ADMIN (campo approvedBy).",
    };
  }

  return { ok: true };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retorna true se o stage é terminal e não permite mais transições de avanço.
 * WON é terminal absoluto; LOST permite re-engagement para DISCOVERY.
 */
export function isTerminalStage(stage: DealStage): boolean {
  return stage === DealStage.WON;
}

/**
 * Retorna true se a transição representa ganho de deal (→ WON).
 */
export function isWinningTransition(from: DealStage, to: DealStage): boolean {
  return from === DealStage.NEGOTIATION && to === DealStage.WON;
}

/**
 * Retorna true se a transição representa perda de deal (→ LOST).
 */
export function isLosingTransition(_from: DealStage, to: DealStage): boolean {
  return to === DealStage.LOST;
}

/**
 * Retorna true se a transição representa re-engagement (LOST → DISCOVERY).
 */
export function isReEngagement(from: DealStage, to: DealStage): boolean {
  return from === DealStage.LOST && to === DealStage.DISCOVERY;
}

/**
 * Lista todas as transições possíveis a partir de um stage.
 */
export function getAllowedTransitions(stage: DealStage): DealStage[] {
  return [...ALLOWED_TRANSITIONS[stage]];
}

/**
 * Calcula o número de dias desde a criação do deal (ciclo de vendas).
 */
export function calcCycleTimeDays(createdAt: Date, closedAt: Date = new Date()): number {
  return Math.round((closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
}
