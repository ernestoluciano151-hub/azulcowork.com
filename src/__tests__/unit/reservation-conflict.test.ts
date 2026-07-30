/**
 * Testes unitários — Conflict Check (DT-013)
 * VOL04-1D
 *
 * Valida a fórmula de sobreposição de reservas:
 *   hasConflict = existStart < newEnd && existEnd > newStart
 *
 * Adjacentes (newEnd === existStart ou newStart === existEnd) NÃO são conflito.
 * Apenas estados em OCCUPYING_STATUSES bloqueiam o slot.
 */

import { describe, it, expect } from "vitest";
import { OCCUPYING_STATUSES } from "@/lib/reservation-state-machine";

// ── Helper puro (sem Prisma) ───────────────────────────────────────────────────
// Replica exactamente o WHERE usado nas routes:
//   status: { in: OCCUPYING_STATUSES }
//   AND: [{ startDatetime: { lt: newEnd } }, { endDatetime: { gt: newStart } }]

interface MockReservation {
  id:            string;
  status:        string;
  startDatetime: Date;
  endDatetime:   Date;
}

function hasConflict(
  existing: MockReservation,
  newStart: Date,
  newEnd:   Date,
  excludeId?: string
): boolean {
  if (excludeId && existing.id === excludeId) return false;
  if (!OCCUPYING_STATUSES.includes(existing.status as never))  return false;
  // existStart < newEnd  &&  existEnd > newStart
  return existing.startDatetime < newEnd && existing.endDatetime > newStart;
}

function anyConflict(
  reservations: MockReservation[],
  newStart:     Date,
  newEnd:       Date,
  excludeId?:   string
): boolean {
  return reservations.some(r => hasConflict(r, newStart, newEnd, excludeId));
}

// ── Datas de referência ────────────────────────────────────────────────────────
const D = (h: number, m = 0) => new Date(2026, 6, 29, h, m); // 29 Jul 2026

const BASE: MockReservation = {
  id:            "existing-1",
  status:        "CONFIRMADA",
  startDatetime: D(9),   // 09:00
  endDatetime:   D(11),  // 11:00
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Sobreposições (conflito)
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — Conflict Check: sobreposições", () => {
  it("nova reserva começa antes e termina durante (sobreposição inicial)", () => {
    // 08:00–10:00 vs 09:00–11:00
    expect(hasConflict(BASE, D(8), D(10))).toBe(true);
  });

  it("nova reserva começa durante e termina depois (sobreposição final)", () => {
    // 10:00–12:00 vs 09:00–11:00
    expect(hasConflict(BASE, D(10), D(12))).toBe(true);
  });

  it("nova reserva está completamente dentro da existente", () => {
    // 09:30–10:30 vs 09:00–11:00
    expect(hasConflict(BASE, D(9, 30), D(10, 30))).toBe(true);
  });

  it("nova reserva envolve completamente a existente", () => {
    // 08:00–12:00 vs 09:00–11:00
    expect(hasConflict(BASE, D(8), D(12))).toBe(true);
  });

  it("nova reserva coincide exactamente com a existente", () => {
    // 09:00–11:00 vs 09:00–11:00
    expect(hasConflict(BASE, D(9), D(11))).toBe(true);
  });

  it("nova reserva começa exactamente quando a existente começa", () => {
    // 09:00–10:00 (começa na mesma hora)
    expect(hasConflict(BASE, D(9), D(10))).toBe(true);
  });

  it("nova reserva termina exactamente quando a existente termina", () => {
    // 10:00–11:00 (termina na mesma hora)
    expect(hasConflict(BASE, D(10), D(11))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Sem conflito (slots adjacentes ou separados)
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — Conflict Check: sem conflito", () => {
  it("nova reserva começa exactamente quando a existente termina (adjacente pós)", () => {
    // 11:00–13:00 (começa quando a existente termina — NÃO é conflito)
    expect(hasConflict(BASE, D(11), D(13))).toBe(false);
  });

  it("nova reserva termina exactamente quando a existente começa (adjacente pré)", () => {
    // 07:00–09:00 (termina quando a existente começa — NÃO é conflito)
    expect(hasConflict(BASE, D(7), D(9))).toBe(false);
  });

  it("nova reserva é completamente depois da existente", () => {
    // 12:00–14:00
    expect(hasConflict(BASE, D(12), D(14))).toBe(false);
  });

  it("nova reserva é completamente antes da existente", () => {
    // 06:00–08:00
    expect(hasConflict(BASE, D(6), D(8))).toBe(false);
  });

  it("reserva excluída por ID não gera conflito (edição da própria reserva)", () => {
    // Actualizar a própria reserva: excluir pelo ID
    expect(hasConflict(BASE, D(9), D(11), "existing-1")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Estados que bloqueiam (OCCUPYING_STATUSES)
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — Conflict Check: estados que bloqueiam slot", () => {
  it("CONFIRMADA bloqueia slot (conflito detectado)", () => {
    const r: MockReservation = { ...BASE, status: "CONFIRMADA" };
    expect(hasConflict(r, D(9), D(12))).toBe(true);
  });

  it("RESERVADO bloqueia slot (conflito detectado)", () => {
    const r: MockReservation = { ...BASE, status: "RESERVADO" };
    expect(hasConflict(r, D(9), D(12))).toBe(true);
  });

  it("PENDENTE_APROVACAO bloqueia slot (conflito detectado)", () => {
    const r: MockReservation = { ...BASE, status: "PENDENTE_APROVACAO" };
    expect(hasConflict(r, D(9), D(12))).toBe(true);
  });

  it("CANCELADA NÃO bloqueia slot (slot fica livre)", () => {
    const r: MockReservation = { ...BASE, status: "CANCELADA" };
    expect(hasConflict(r, D(9), D(12))).toBe(false);
  });

  it("CONCLUIDA NÃO bloqueia slot (evento já ocorreu)", () => {
    const r: MockReservation = { ...BASE, status: "CONCLUIDA" };
    expect(hasConflict(r, D(9), D(12))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. anyConflict — lista de reservas
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — Conflict Check: lista de reservas", () => {
  const reservations: MockReservation[] = [
    { id: "r1", status: "CONFIRMADA",        startDatetime: D(8),  endDatetime: D(10) },
    { id: "r2", status: "RESERVADO",         startDatetime: D(11), endDatetime: D(13) },
    { id: "r3", status: "CANCELADA",         startDatetime: D(9),  endDatetime: D(12) }, // não bloqueia
    { id: "r4", status: "PENDENTE_APROVACAO", startDatetime: D(14), endDatetime: D(16) },
  ];

  it("detecta conflito com r1 (CONFIRMADA, 08:00–10:00)", () => {
    // nova: 09:00–11:00 → conflito com r1
    expect(anyConflict(reservations, D(9), D(11))).toBe(true);
  });

  it("slot livre entre r1 e r2 (10:00–11:00) não conflita", () => {
    expect(anyConflict(reservations, D(10), D(11))).toBe(false);
  });

  it("não conflita com CANCELADA mesmo em sobreposição total", () => {
    // r3 (CANCELADA) cobre 09:00–12:00 mas não bloqueia; r1 (CONFIRMADA) 08:00–10:00 conflita com 09:00–11:00
    // Usar slot sem r1: 12:00–13:30 → r2 adjacente por fora (não conflita), r3 cancelada
    expect(anyConflict(reservations, D(12), D(13))).toBe(false);
  });

  it("detecta conflito com r4 (PENDENTE_APROVACAO, 14:00–16:00)", () => {
    expect(anyConflict(reservations, D(14, 30), D(15))).toBe(true);
  });
});
