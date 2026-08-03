/**
 * pricing-service.test.ts — Testes unitários de src/lib/pricing-service.ts
 *
 * Cobre: matchTier, calcPriceFromTier, calcPrice, priceModeLabel
 * Todos os valores em AOA (moeda da plataforma).
 */

import { describe, it, expect } from "vitest";
import {
  matchTier,
  calcPriceFromTier,
  calcPrice,
  priceModeLabel,
  roundBillableHours,
  ROOM_HOURLY_RATE_KZ,
  type RoomPricingTier,
  type PlanPricing,
} from "@/lib/pricing-service";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const tiers: RoomPricingTier[] = [
  { id: "t1", label: "1 Hora",       durationMinutes: 60,  price: 15000 },
  { id: "t2", label: "2 Horas",      durationMinutes: 120, price: 25000 },
  { id: "t3", label: "Meio Período", durationMinutes: 240, price: 50000 },
  { id: "t4", label: "Dia Inteiro",  durationMinutes: 480, price: 90000 },
];

const plan: PlanPricing = {
  pricePerHour:    15000,
  halfDayPrice:    50000,  // >= 3h
  fullDayPrice:    90000,  // >= 6h
  weekendPrice:    120000,
  coffeeBreakPrice: 5000,
};

// ─────────────────────────────────────────────
// matchTier
// ─────────────────────────────────────────────
describe("matchTier", () => {
  it("encontra tier exacto para 60 min", () => {
    expect(matchTier(tiers, 60)?.label).toBe("1 Hora");
  });

  it("encontra tier exacto para 240 min", () => {
    expect(matchTier(tiers, 240)?.label).toBe("Meio Período");
  });

  it("encontra tier mais próximo (inferior) para 90 min → 1 Hora", () => {
    expect(matchTier(tiers, 90)?.label).toBe("1 Hora");
  });

  it("encontra tier mais próximo para 300 min → Meio Período (240)", () => {
    expect(matchTier(tiers, 300)?.label).toBe("Meio Período");
  });

  it("retorna undefined para 0 min (nenhum tier aplicável)", () => {
    expect(matchTier(tiers, 0)).toBeUndefined();
  });

  it("retorna Dia Inteiro para 600 min (> 480)", () => {
    expect(matchTier(tiers, 600)?.label).toBe("Dia Inteiro");
  });

  it("retorna undefined para lista vazia", () => {
    expect(matchTier([], 60)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// calcPriceFromTier
// ─────────────────────────────────────────────
describe("calcPriceFromTier", () => {
  const tier = tiers[2]; // Meio Período — 50.000 AOA

  it("sem coffee break, sem desconto, sem IVA", () => {
    const r = calcPriceFromTier(tier, 5000, false, 0, 0);
    expect(r.priceMode).toBe("tier");
    expect(r.tierLabel).toBe("Meio Período");
    expect(r.baseAmount).toBe(50000);
    expect(r.coffeeExtra).toBe(0);
    expect(r.totalAmount).toBe(50000);
    expect(r.discountApplied).toBe(0);
  });

  it("com coffee break (5.000 AOA)", () => {
    const r = calcPriceFromTier(tier, 5000, true, 0, 0);
    expect(r.coffeeExtra).toBe(5000);
    expect(r.subtotal).toBe(55000);
    expect(r.totalAmount).toBe(55000);
  });

  it("com desconto de 10.000 AOA", () => {
    const r = calcPriceFromTier(tier, 5000, false, 10000, 0);
    expect(r.discountApplied).toBe(10000);
    expect(r.afterDiscount).toBe(40000);
    expect(r.totalAmount).toBe(40000);
  });

  it("com IVA de 14%", () => {
    const r = calcPriceFromTier(tier, 5000, false, 0, 14);
    const expected = Math.round(50000 * 1.14 * 100) / 100;
    expect(r.totalAmount).toBe(expected);
    expect(r.ivaAmount).toBeCloseTo(7000, 0);
  });

  it("desconto não pode exceder o subtotal", () => {
    const r = calcPriceFromTier(tier, 5000, false, 999999, 0);
    expect(r.discountApplied).toBe(50000); // limitado ao subtotal
    expect(r.totalAmount).toBe(0);
  });
});

// ─────────────────────────────────────────────
// calcPrice (fallback sem tier DB)
// ─────────────────────────────────────────────
describe("calcPrice", () => {
  it("modo hourly para 2 horas", () => {
    const r = calcPrice({ plan, totalHours: 2, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.priceMode).toBe("hourly");
    expect(r.baseAmount).toBe(30000); // 2 × 15.000
  });

  it("modo halfDay para 4 horas (halfDayPrice=50k < 4×15k=60k)", () => {
    // halfDay activa quando totalHours >= 3 E halfDayPrice < pricePerHour * totalHours
    // 4h: 50.000 < 4 × 15.000 = 60.000 → halfDay activo
    const r = calcPrice({ plan, totalHours: 4, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.priceMode).toBe("halfDay");
    expect(r.baseAmount).toBe(50000);
  });

  it("modo hourly para 3 horas (halfDayPrice=50k > 3×15k=45k)", () => {
    // 3h: 50.000 > 45.000 → halfDay NÃO é mais barato → hourly
    const r = calcPrice({ plan, totalHours: 3, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.priceMode).toBe("hourly");
    expect(r.baseAmount).toBe(45000);
  });

  it("modo fullDay para 6 horas", () => {
    const r = calcPrice({ plan, totalHours: 6, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.priceMode).toBe("fullDay");
    expect(r.baseAmount).toBe(90000);
  });

  it("modo fullDay para 8 horas", () => {
    const r = calcPrice({ plan, totalHours: 8, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.priceMode).toBe("fullDay");
    expect(r.baseAmount).toBe(90000);
  });

  it("modo weekend quando isWeekend = true", () => {
    const r = calcPrice({ plan, totalHours: 4, coffeeBreak: false, discount: 0, ivaPercent: 0, isWeekend: true });
    expect(r.priceMode).toBe("weekend");
    expect(r.baseAmount).toBe(120000);
  });

  it("detecta fim-de-semana via startDate (Sábado)", () => {
    const saturday = new Date("2026-08-01"); // Sábado
    const r = calcPrice({ plan, totalHours: 4, coffeeBreak: false, discount: 0, ivaPercent: 0, startDate: saturday });
    expect(r.priceMode).toBe("weekend");
  });

  it("detecta fim-de-semana via startDate (Domingo)", () => {
    const sunday = new Date("2026-08-02"); // Domingo
    const r = calcPrice({ plan, totalHours: 4, coffeeBreak: false, discount: 0, ivaPercent: 0, startDate: sunday });
    expect(r.priceMode).toBe("weekend");
  });

  it("dia útil com startDate não é weekend", () => {
    const monday = new Date("2026-08-03"); // Segunda
    const r = calcPrice({ plan, totalHours: 2, coffeeBreak: false, discount: 0, ivaPercent: 0, startDate: monday });
    expect(r.priceMode).not.toBe("weekend");
  });

  it("coffee break adicionado ao subtotal", () => {
    const r = calcPrice({ plan, totalHours: 2, coffeeBreak: true, discount: 0, ivaPercent: 0 });
    expect(r.coffeeExtra).toBe(5000);
    expect(r.subtotal).toBe(35000); // 30.000 + 5.000
  });

  it("IVA de 14% calculado sobre after-discount", () => {
    const r = calcPrice({ plan, totalHours: 2, coffeeBreak: false, discount: 0, ivaPercent: 14 });
    const expectedIva = Math.round(30000 * 0.14 * 100) / 100;
    expect(r.ivaAmount).toBeCloseTo(expectedIva, 0);
    expect(r.totalAmount).toBeCloseTo(30000 + expectedIva, 0);
  });

  it("plano sem halfDayPrice usa hourly para 3 horas", () => {
    const planSemHalfDay = { ...plan, halfDayPrice: 0 };
    const r = calcPrice({ plan: planSemHalfDay, totalHours: 3, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.priceMode).toBe("hourly");
    expect(r.baseAmount).toBe(45000);
  });

  // ── VOL04-4: precedência e casos edge ─────────────────────────────────────

  it("weekend tem precedência sobre fullDay (8h em fim-de-semana)", () => {
    // 8h satisfaz fullDay (>=6h) E weekend — weekend prevalece
    const r = calcPrice({ plan, totalHours: 8, coffeeBreak: false, discount: 0, ivaPercent: 0, isWeekend: true });
    expect(r.priceMode).toBe("weekend");
    expect(r.baseAmount).toBe(120000); // weekendPrice, não fullDayPrice
  });

  it("fullDay tem precedência sobre halfDay (6h)", () => {
    // 6h satisfaz halfDay (>=3h) E fullDay (>=6h) — fullDay prevalece
    const r = calcPrice({ plan, totalHours: 6, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.priceMode).toBe("fullDay");
    expect(r.baseAmount).toBe(90000);
  });

  it("desconto superior ao subtotal é capado ao subtotal (nunca negativo)", () => {
    const r = calcPrice({ plan, totalHours: 2, coffeeBreak: false, discount: 999999, ivaPercent: 0 });
    expect(r.discountApplied).toBe(30000); // = subtotal
    expect(r.afterDiscount).toBe(0);
    expect(r.totalAmount).toBe(0);
  });

  it("arredondamento a 2 casas decimais em IVA", () => {
    // 3333 AOA/h × 1h = 3333; 3333 × 14% = 466.62
    const planFrac: PlanPricing = { ...plan, pricePerHour: 3333 };
    const r = calcPrice({ plan: planFrac, totalHours: 1, coffeeBreak: false, discount: 0, ivaPercent: 14 });
    expect(r.ivaAmount).toBe(466.62);
    expect(r.totalAmount).toBe(3799.62);
  });

  it("plano sem weekendPrice: isWeekend=true usa fullDay se >=6h", () => {
    const planSemWeekend = { ...plan, weekendPrice: 0 };
    const r = calcPrice({ plan: planSemWeekend, totalHours: 8, coffeeBreak: false, discount: 0, ivaPercent: 0, isWeekend: true });
    expect(r.priceMode).toBe("fullDay"); // weekendPrice=0 → não activa; usa fullDay
  });
});

// ─────────────────────────────────────────────
// roundBillableHours — regra dos 30 minutos (Sala de Reunião, 15.000 Kz/h)
// ─────────────────────────────────────────────
describe("roundBillableHours", () => {
  it("60 min → 1h (exacto)", () => {
    expect(roundBillableHours(60)).toBe(1);
  });

  it("80 min (1h20) → 1h (excedente de 20 min, não passa de 30)", () => {
    expect(roundBillableHours(80)).toBe(1);
  });

  it("90 min (1h30) → 1h (excedente de exactamente 30 min — ainda não passou)", () => {
    expect(roundBillableHours(90)).toBe(1);
  });

  it("91 min (1h31) → 2h (excedente de 31 min > 30 — mais próximo de 2h)", () => {
    expect(roundBillableHours(91)).toBe(2);
  });

  it("120 min → 2h (exacto)", () => {
    expect(roundBillableHours(120)).toBe(2);
  });

  it("150 min (2h30) → 2h (fronteira dos 30 min)", () => {
    expect(roundBillableHours(150)).toBe(2);
  });

  it("151 min (2h31) → 3h", () => {
    expect(roundBillableHours(151)).toBe(3);
  });

  it("20 min → 1h (mínimo facturável)", () => {
    expect(roundBillableHours(20)).toBe(1);
  });

  it("0 min → 0h", () => {
    expect(roundBillableHours(0)).toBe(0);
  });
});

// ─────────────────────────────────────────────
// calcPrice — nova fórmula horária com arredondamento (15.000 Kz/h)
// ─────────────────────────────────────────────
describe("calcPrice — facturação horária com arredondamento de 30 min", () => {
  const planSemPricePerHour: PlanPricing = {
    pricePerHour:     0, // plano sem tarifa própria → usa ROOM_HOURLY_RATE_KZ
    halfDayPrice:     0,
    fullDayPrice:     0,
    weekendPrice:     0,
    coffeeBreakPrice: 0,
  };

  it("usa 15.000 Kz/h por defeito quando o plano não tem pricePerHour", () => {
    const r = calcPrice({ plan: planSemPricePerHour, totalHours: 1, totalMinutes: 60, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.baseAmount).toBe(ROOM_HOURLY_RATE_KZ);
  });

  it("1h20 (80 min) cobra 1h = 15.000 Kz (não passa dos 30 min de excedente)", () => {
    const r = calcPrice({ plan: planSemPricePerHour, totalHours: 80 / 60, totalMinutes: 80, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.baseAmount).toBe(15000);
  });

  it("1h31 (91 min) cobra 2h = 30.000 Kz (passa dos 30 min de excedente)", () => {
    const r = calcPrice({ plan: planSemPricePerHour, totalHours: 91 / 60, totalMinutes: 91, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.baseAmount).toBe(30000);
  });

  it("2h exactas cobram 30.000 Kz", () => {
    const r = calcPrice({ plan: planSemPricePerHour, totalHours: 2, totalMinutes: 120, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.baseAmount).toBe(30000);
  });

  it("respeita pricePerHour do plano quando definido (não usa os 15.000 por defeito)", () => {
    const planCom20k = { ...planSemPricePerHour, pricePerHour: 20000 };
    const r = calcPrice({ plan: planCom20k, totalHours: 1, totalMinutes: 60, coffeeBreak: false, discount: 0, ivaPercent: 0 });
    expect(r.baseAmount).toBe(20000);
  });
});

// ─────────────────────────────────────────────
// priceModeLabel
// ─────────────────────────────────────────────
describe("priceModeLabel", () => {
  it("hourly → 'Por hora'", () => {
    expect(priceModeLabel("hourly")).toBe("Por hora");
  });

  it("halfDay → 'Meio dia'", () => {
    expect(priceModeLabel("halfDay")).toBe("Meio dia");
  });

  it("fullDay → 'Dia inteiro'", () => {
    expect(priceModeLabel("fullDay")).toBe("Dia inteiro");
  });

  it("weekend → 'Fim de semana'", () => {
    expect(priceModeLabel("weekend")).toBe("Fim de semana");
  });

  it("tier com label → usa o label do tier", () => {
    expect(priceModeLabel("tier", "Meio Período")).toBe("Meio Período");
  });

  it("tier sem label → 'Tabela'", () => {
    expect(priceModeLabel("tier")).toBe("Tabela");
  });
});
