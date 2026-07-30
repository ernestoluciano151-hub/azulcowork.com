/**
 * bi-helpers.test.ts — VOL06-1
 *
 * Testa as funções utilitárias puras do módulo bi-helpers:
 * monthKey, lastNMonths, workingDaysInMonth, zeroMap, buildOccupancyResult
 */

import { describe, it, expect } from "vitest";
import {
  monthKey,
  lastNMonths,
  workingDaysInMonth,
  zeroMap,
  buildOccupancyResult,
} from "@/lib/bi-helpers";

// ── monthKey ──────────────────────────────────────────────────────────────────

describe("monthKey", () => {
  it("formata mês com padding", () => {
    expect(monthKey(new Date("2026-01-15"))).toBe("2026-01");
    expect(monthKey(new Date("2026-12-31"))).toBe("2026-12");
  });

  it("formata mês de Julho correctamente", () => {
    expect(monthKey(new Date("2026-07-29"))).toBe("2026-07");
  });

  it("trata anos e meses de dois dígitos", () => {
    expect(monthKey(new Date("2025-09-01"))).toBe("2025-09");
  });
});

// ── lastNMonths ───────────────────────────────────────────────────────────────

describe("lastNMonths", () => {
  it("devolve exactamente N meses", () => {
    expect(lastNMonths(12)).toHaveLength(12);
    expect(lastNMonths(1)).toHaveLength(1);
    expect(lastNMonths(24)).toHaveLength(24);
  });

  it("o último mês é o mês actual", () => {
    const months = lastNMonths(3);
    const now = new Date();
    const currentMonth = monthKey(now);
    expect(months[months.length - 1]).toBe(currentMonth);
  });

  it("os meses estão em ordem crescente", () => {
    const months = lastNMonths(6);
    for (let i = 1; i < months.length; i++) {
      expect(months[i] > months[i - 1]).toBe(true);
    }
  });

  it("devolve 1 mês correctamente", () => {
    const months = lastNMonths(1);
    const currentMonth = monthKey(new Date());
    expect(months).toEqual([currentMonth]);
  });
});

// ── workingDaysInMonth ────────────────────────────────────────────────────────

describe("workingDaysInMonth", () => {
  it("Janeiro tem ~22 dias úteis", () => {
    // Janeiro 2026: 31 dias → Math.round(31 * 5/7) = Math.round(22.14) = 22
    expect(workingDaysInMonth("2026-01")).toBe(22);
  });

  it("Fevereiro tem ~20 dias úteis (28 dias)", () => {
    // Fevereiro 2026: 28 dias → Math.round(28 * 5/7) = Math.round(20) = 20
    expect(workingDaysInMonth("2026-02")).toBe(20);
  });

  it("Julho tem ~22 dias úteis", () => {
    // Julho 2026: 31 dias → Math.round(31 * 5/7) = 22
    expect(workingDaysInMonth("2026-07")).toBe(22);
  });

  it("nunca devolve 0 para um mês válido", () => {
    const months = ["2026-01","2026-06","2026-12"];
    for (const m of months) {
      expect(workingDaysInMonth(m)).toBeGreaterThan(0);
    }
  });
});

// ── zeroMap ───────────────────────────────────────────────────────────────────

describe("zeroMap", () => {
  it("inicializa todas as chaves a 0", () => {
    const keys = ["2026-05", "2026-06", "2026-07"];
    const map = zeroMap(keys);
    expect(map["2026-05"]).toBe(0);
    expect(map["2026-06"]).toBe(0);
    expect(map["2026-07"]).toBe(0);
  });

  it("devolve objecto vazio para array vazio", () => {
    expect(zeroMap([])).toEqual({});
  });
});

// ── buildOccupancyResult ──────────────────────────────────────────────────────

describe("buildOccupancyResult", () => {
  const monthsList = ["2026-06", "2026-07"];
  const dailyHours = 10;

  it("calcula a taxa de ocupação correctamente", () => {
    const bookedMap = { "2026-06": 44, "2026-07": 22 };
    const result = buildOccupancyResult(monthsList, bookedMap, dailyHours);

    expect(result).toHaveLength(2);
    // Junho: 30 dias → 21 úteis × 10h = 210h disponíveis
    expect(result[0].month).toBe("2026-06");
    expect(result[0].bookedHours).toBe(44);
    expect(result[0].availableHours).toBe(21 * 10); // 210
    expect(result[0].rate).toBeCloseTo((44 / 210) * 100, 0);
  });

  it("taxa 0% quando bookedMap é 0", () => {
    const bookedMap = { "2026-06": 0, "2026-07": 0 };
    const result = buildOccupancyResult(monthsList, bookedMap, dailyHours);
    expect(result[0].rate).toBe(0);
    expect(result[1].rate).toBe(0);
  });

  it("usa 0 para chave em falta no bookedMap", () => {
    const bookedMap = { "2026-06": 10 }; // "2026-07" em falta
    const result = buildOccupancyResult(monthsList, bookedMap, dailyHours);
    expect(result[1].bookedHours).toBe(0);
    expect(result[1].rate).toBe(0);
  });

  it("dailyHours 0 → rate 0 (evita divisão por zero)", () => {
    const bookedMap = { "2026-06": 10, "2026-07": 5 };
    const result = buildOccupancyResult(monthsList, bookedMap, 0);
    expect(result[0].rate).toBe(0);
    expect(result[0].availableHours).toBe(0);
  });
});
