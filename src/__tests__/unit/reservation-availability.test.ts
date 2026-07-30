/**
 * Testes unitários — computeFreeSlots
 * VOL04-2C
 *
 * Testa o algoritmo de cálculo de slots livres para o endpoint de disponibilidade.
 * A função é pura (sem I/O) e exportada de src/app/api/reservations/availability/route.ts.
 *
 * Algoritmo:
 *  1. Ordenar slots ocupados por início
 *  2. Cursor começa em openTime
 *  3. Para cada slot: se cursor < slot.start → livre de cursor a slot.start
 *  4. Avançar cursor para max(cursor, slot.end)
 *  5. Se cursor < closeTime → livre de cursor a closeTime
 */

import { describe, it, expect } from "vitest";
import { computeFreeSlots } from "@/app/api/reservations/availability/route";

// ── Helper ────────────────────────────────────────────────────────────────────
const DATE = "2026-07-29";

function dt(time: string): Date {
  return new Date(`${DATE}T${time}:00.000Z`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Sem reservas
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — computeFreeSlots: sem reservas", () => {
  it("dia vazio → um único slot livre igual ao horário de funcionamento", () => {
    expect(computeFreeSlots("08:00", "18:00", DATE, [])).toEqual([
      { from: "08:00", to: "18:00" },
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Uma reserva
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — computeFreeSlots: uma reserva", () => {
  it("reserva no meio do dia → dois slots livres (antes e depois)", () => {
    expect(
      computeFreeSlots("08:00", "18:00", DATE, [
        { from: dt("09:00"), to: dt("11:00") },
      ])
    ).toEqual([
      { from: "08:00", to: "09:00" },
      { from: "11:00", to: "18:00" },
    ]);
  });

  it("reserva ocupa todo o dia → nenhum slot livre", () => {
    expect(
      computeFreeSlots("08:00", "18:00", DATE, [
        { from: dt("08:00"), to: dt("18:00") },
      ])
    ).toEqual([]);
  });

  it("reserva no início → livre apenas no final", () => {
    expect(
      computeFreeSlots("08:00", "18:00", DATE, [
        { from: dt("08:00"), to: dt("10:00") },
      ])
    ).toEqual([{ from: "10:00", to: "18:00" }]);
  });

  it("reserva no final → livre apenas no início", () => {
    expect(
      computeFreeSlots("08:00", "18:00", DATE, [
        { from: dt("16:00"), to: dt("18:00") },
      ])
    ).toEqual([{ from: "08:00", to: "16:00" }]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Múltiplas reservas
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — computeFreeSlots: múltiplas reservas", () => {
  it("duas reservas adjacentes → gap é zero, sem slot entre elas", () => {
    expect(
      computeFreeSlots("08:00", "18:00", DATE, [
        { from: dt("09:00"), to: dt("11:00") },
        { from: dt("11:00"), to: dt("13:00") },
      ])
    ).toEqual([
      { from: "08:00", to: "09:00" },
      { from: "13:00", to: "18:00" },
    ]);
  });

  it("duas reservas com gap → três slots livres", () => {
    expect(
      computeFreeSlots("08:00", "18:00", DATE, [
        { from: dt("09:00"), to: dt("11:00") },
        { from: dt("14:00"), to: dt("16:00") },
      ])
    ).toEqual([
      { from: "08:00", to: "09:00" },
      { from: "11:00", to: "14:00" },
      { from: "16:00", to: "18:00" },
    ]);
  });

  it("três reservas com gaps → quatro slots livres", () => {
    expect(
      computeFreeSlots("08:00", "18:00", DATE, [
        { from: dt("08:30"), to: dt("09:30") },
        { from: dt("11:00"), to: dt("13:00") },
        { from: dt("15:00"), to: dt("16:00") },
      ])
    ).toEqual([
      { from: "08:00", to: "08:30" },
      { from: "09:30", to: "11:00" },
      { from: "13:00", to: "15:00" },
      { from: "16:00", to: "18:00" },
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Slots fora do horário
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — computeFreeSlots: slots fora do horário", () => {
  it("slot completamente antes da abertura → ignorado; dia fica totalmente livre", () => {
    expect(
      computeFreeSlots("08:00", "18:00", DATE, [
        { from: dt("06:00"), to: dt("07:00") },
      ])
    ).toEqual([{ from: "08:00", to: "18:00" }]);
  });

  it("slot começa antes da abertura e termina durante → só conta a parte dentro do horário", () => {
    expect(
      computeFreeSlots("08:00", "18:00", DATE, [
        { from: dt("07:00"), to: dt("10:00") },
      ])
    ).toEqual([{ from: "10:00", to: "18:00" }]);
  });
});
