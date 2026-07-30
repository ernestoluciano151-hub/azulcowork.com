/**
 * Testes unitários — Política de Cancelamento (BR-RES-005)
 * VOL04-1D
 *
 * Valida:
 *   - isCancellationFree(): ≥ 24h → reembolso total, < 24h → sem reembolso
 *   - CANCELLATION_FREE_HOURS === 24 (constante)
 *   - Exactamente 24h de antecedência → elegível (limite inclusivo)
 *   - Exactamente 23h59m de antecedência → não elegível
 */

import { describe, it, expect } from "vitest";
import {
  isCancellationFree,
  CANCELLATION_FREE_HOURS,
} from "@/lib/reservation-state-machine";

// ── Helper ────────────────────────────────────────────────────────────────────
function hoursFromNow(h: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + h * 60 * 60 * 1000);
}

// ── Momento de referência fixo para todos os testes ──────────────────────────
const NOW = new Date("2026-07-29T10:00:00Z");

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Regra das 24h — elegibilidade de reembolso
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — Cancelamento: regra de 24h", () => {
  it("evento daqui a 48h → elegível para reembolso total", () => {
    const start = hoursFromNow(48, NOW);
    expect(isCancellationFree(start, NOW)).toBe(true);
  });

  it("evento daqui a 25h → elegível para reembolso total", () => {
    const start = hoursFromNow(25, NOW);
    expect(isCancellationFree(start, NOW)).toBe(true);
  });

  it("exactamente 24h de antecedência → elegível (limite inclusivo)", () => {
    const start = hoursFromNow(24, NOW);
    expect(isCancellationFree(start, NOW)).toBe(true);
  });

  it("23h59m de antecedência → NÃO elegível (abaixo do limite)", () => {
    const start = new Date(NOW.getTime() + (24 * 60 - 1) * 60 * 1000);
    expect(isCancellationFree(start, NOW)).toBe(false);
  });

  it("evento daqui a 12h → NÃO elegível", () => {
    const start = hoursFromNow(12, NOW);
    expect(isCancellationFree(start, NOW)).toBe(false);
  });

  it("evento daqui a 1h → NÃO elegível (cancelamento em cima da hora)", () => {
    const start = hoursFromNow(1, NOW);
    expect(isCancellationFree(start, NOW)).toBe(false);
  });

  it("evento já no passado → NÃO elegível", () => {
    const start = hoursFromNow(-2, NOW);
    expect(isCancellationFree(start, NOW)).toBe(false);
  });

  it("usa Date.now() como fallback quando now não é fornecido", () => {
    // Evento no futuro longínquo → sempre elegível
    const start = new Date(Date.now() + 72 * 60 * 60 * 1000);
    expect(isCancellationFree(start)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CANCELLATION_FREE_HOURS — constante
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — Cancelamento: CANCELLATION_FREE_HOURS constante", () => {
  it("CANCELLATION_FREE_HOURS é exactamente 24", () => {
    expect(CANCELLATION_FREE_HOURS).toBe(24);
  });

  it("constante é do tipo number", () => {
    expect(typeof CANCELLATION_FREE_HOURS).toBe("number");
  });
});
