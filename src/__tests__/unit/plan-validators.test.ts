/**
 * Testes unitários — plan-validators
 * VOL04-3C
 *
 * Testa as funções puras de validação de MeetingPlan e RoomSettings:
 *   validatePlanPrices()   — preços não negativos
 *   validateMaxPeople()    — capacidade >= 1
 *   validateRoomSettings() — openTime, closeTime, minHours, maxHours, maxDiscount
 *   parseTime()            — parse HH:MM
 */

import { describe, it, expect } from "vitest";
import {
  validatePlanPrices,
  validateMaxPeople,
  validateRoomSettings,
  parseTime,
} from "@/lib/plan-validators";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. validatePlanPrices
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — validatePlanPrices", () => {
  it("preço negativo em pricePerHour → erro", () => {
    expect(validatePlanPrices({ pricePerHour: -1 })).toEqual({
      error: "Preços não podem ser negativos.",
    });
  });

  it("preço negativo em coffeeBreakPrice → erro", () => {
    expect(validatePlanPrices({ coffeeBreakPrice: -0.01 })).toEqual({
      error: "Preços não podem ser negativos.",
    });
  });

  it("preço negativo em halfDayPrice → erro", () => {
    expect(validatePlanPrices({ halfDayPrice: -500 })).toEqual({
      error: "Preços não podem ser negativos.",
    });
  });

  it("preço negativo em weekendPrice → erro", () => {
    expect(validatePlanPrices({ weekendPrice: -1 })).toEqual({
      error: "Preços não podem ser negativos.",
    });
  });

  it("zero é válido (preço gratuito)", () => {
    expect(validatePlanPrices({ pricePerHour: 0 })).toBeNull();
  });

  it("preço positivo é válido", () => {
    expect(validatePlanPrices({ pricePerHour: 5000, coffeeBreakPrice: 1500 })).toBeNull();
  });

  it("body vazio é válido", () => {
    expect(validatePlanPrices({})).toBeNull();
  });

  it("campo ausente não é validado", () => {
    expect(validatePlanPrices({ fullDayPrice: undefined })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. validateMaxPeople
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — validateMaxPeople", () => {
  it("0 → erro", () => {
    expect(validateMaxPeople(0)).toEqual({ error: "Capacidade máxima deve ser ≥ 1." });
  });

  it("valor negativo → erro", () => {
    expect(validateMaxPeople(-5)).toEqual({ error: "Capacidade máxima deve ser ≥ 1." });
  });

  it("undefined → erro (campo obrigatório em POST)", () => {
    expect(validateMaxPeople(undefined)).toEqual({ error: "Capacidade máxima deve ser ≥ 1." });
  });

  it("null → erro", () => {
    expect(validateMaxPeople(null)).toEqual({ error: "Capacidade máxima deve ser ≥ 1." });
  });

  it("1 → válido (mínimo aceite)", () => {
    expect(validateMaxPeople(1)).toBeNull();
  });

  it("50 → válido", () => {
    expect(validateMaxPeople(50)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. parseTime
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — parseTime", () => {
  it("'08:00' → 480 minutos", () => {
    expect(parseTime("08:00")).toBe(480);
  });

  it("'18:00' → 1080 minutos", () => {
    expect(parseTime("18:00")).toBe(1080);
  });

  it("'00:00' → 0 minutos", () => {
    expect(parseTime("00:00")).toBe(0);
  });

  it("'23:59' → 1439 minutos", () => {
    expect(parseTime("23:59")).toBe(1439);
  });

  it("formato '8:0' → null (falta zero à esquerda)", () => {
    expect(parseTime("8:0")).toBeNull();
  });

  it("'25:00' → null (hora inválida)", () => {
    expect(parseTime("25:00")).toBeNull();
  });

  it("'08:60' → null (minuto inválido)", () => {
    expect(parseTime("08:60")).toBeNull();
  });

  it("texto livre → null", () => {
    expect(parseTime("oito horas")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. validateRoomSettings — openTime / closeTime
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — validateRoomSettings: openTime / closeTime", () => {
  it("openTime >= closeTime → erro", () => {
    expect(validateRoomSettings({ openTime: "18:00", closeTime: "08:00" })).toEqual({
      error: "'openTime' deve ser anterior a 'closeTime'.",
    });
  });

  it("openTime === closeTime → erro", () => {
    expect(validateRoomSettings({ openTime: "08:00", closeTime: "08:00" })).toEqual({
      error: "'openTime' deve ser anterior a 'closeTime'.",
    });
  });

  it("'08:00' < '18:00' → válido", () => {
    expect(validateRoomSettings({ openTime: "08:00", closeTime: "18:00" })).toBeNull();
  });

  it("openTime com formato inválido → erro", () => {
    expect(validateRoomSettings({ openTime: "8:0", closeTime: "18:00" })).toEqual({
      error: "'openTime' inválido. Formato esperado: HH:MM.",
    });
  });

  it("closeTime com hora inválida → erro", () => {
    expect(validateRoomSettings({ openTime: "08:00", closeTime: "25:00" })).toEqual({
      error: "'closeTime' inválido. Formato esperado: HH:MM.",
    });
  });

  it("apenas openTime válido (sem closeTime) → válido", () => {
    expect(validateRoomSettings({ openTime: "08:00" })).toBeNull();
  });

  it("apenas closeTime válido (sem openTime) → válido", () => {
    expect(validateRoomSettings({ closeTime: "18:00" })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. validateRoomSettings — minHours / maxHours
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — validateRoomSettings: minHours / maxHours", () => {
  it("minHours 0 → erro", () => {
    expect(validateRoomSettings({ minHours: 0 })).toEqual({
      error: "'minHours' deve ser ≥ 1.",
    });
  });

  it("minHours 1 → válido", () => {
    expect(validateRoomSettings({ minHours: 1 })).toBeNull();
  });

  it("maxHours <= minHours → erro", () => {
    expect(validateRoomSettings({ minHours: 4, maxHours: 4 })).toEqual({
      error: "'maxHours' deve ser superior a 'minHours'.",
    });
  });

  it("maxHours < minHours → erro", () => {
    expect(validateRoomSettings({ minHours: 8, maxHours: 4 })).toEqual({
      error: "'maxHours' deve ser superior a 'minHours'.",
    });
  });

  it("maxHours > minHours → válido", () => {
    expect(validateRoomSettings({ minHours: 1, maxHours: 8 })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. validateRoomSettings — maxDiscount
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL04 — validateRoomSettings: maxDiscount", () => {
  it("maxDiscount -1 → erro", () => {
    expect(validateRoomSettings({ maxDiscount: -1 })).toEqual({
      error: "'maxDiscount' deve estar entre 0 e 100.",
    });
  });

  it("maxDiscount 101 → erro", () => {
    expect(validateRoomSettings({ maxDiscount: 101 })).toEqual({
      error: "'maxDiscount' deve estar entre 0 e 100.",
    });
  });

  it("maxDiscount 0 → válido (sem desconto)", () => {
    expect(validateRoomSettings({ maxDiscount: 0 })).toBeNull();
  });

  it("maxDiscount 100 → válido (desconto total)", () => {
    expect(validateRoomSettings({ maxDiscount: 100 })).toBeNull();
  });

  it("maxDiscount 50 → válido", () => {
    expect(validateRoomSettings({ maxDiscount: 50 })).toBeNull();
  });

  it("body vazio → válido (nenhum campo alterado)", () => {
    expect(validateRoomSettings({})).toBeNull();
  });
});
