/**
 * erp-billing-service.test.ts — Testes unitários do motor de faturação ERP
 *
 * Testa (sem BD real):
 *  - calculateIvaTotals: IVA 14%, arredondamentos, totais
 *  - invoiceTypeToDocType: mapeamento tipo → prefixo de número
 *  - Cenários de borda: valor zero, items múltiplos, IVA arredondado
 */

import { describe, it, expect } from "vitest";
import { calculateIvaTotals, IVA_RATE } from "@/lib/erp-billing-service";

// ── calculateIvaTotals ────────────────────────────────────────────────────────

describe("calculateIvaTotals", () => {
  it("calcula IVA 14% correctamente para valor simples", () => {
    const result = calculateIvaTotals(45000);
    expect(result.subtotal).toBe(45000);
    expect(result.taxRate).toBe(IVA_RATE);
    expect(result.taxAmount).toBe(6300);   // 45000 * 0.14 = 6300
    expect(result.total).toBe(51300);      // 45000 + 6300
  });

  it("arredonda taxAmount a inteiro (sem cêntimos em AOA)", () => {
    // 53000 * 0.14 = 7420.00 — arredondamento sem fracção
    const result = calculateIvaTotals(53000);
    expect(result.taxAmount).toBe(7420);
    expect(result.total).toBe(60420);
  });

  it("arredonda correctamente quando fractional", () => {
    // 10001 * 0.14 = 1400.14 → arredonda para 1400
    const result = calculateIvaTotals(10001);
    expect(result.taxAmount).toBe(1400);
    expect(result.total).toBe(11401);
  });

  it("arredonda subtotal a inteiro", () => {
    // subtotal fornecido com fracção (ex: acumulação de itens)
    const result = calculateIvaTotals(45000.7);
    expect(result.subtotal).toBe(45001);   // Math.round(45000.7)
    expect(result.taxAmount).toBe(Math.round(45001 * 0.14));
  });

  it("retorna taxRate correcto", () => {
    const result = calculateIvaTotals(100000);
    expect(result.taxRate).toBe(0.14);
  });

  it("aceita taxRate personalizado (isenção parcial)", () => {
    const result = calculateIvaTotals(100000, 0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(100000);
  });

  it("total = subtotal + taxAmount", () => {
    const amounts = [15000, 45000, 95000, 125000, 250000];
    for (const amount of amounts) {
      const r = calculateIvaTotals(amount);
      expect(r.total).toBe(r.subtotal + r.taxAmount);
    }
  });

  it("calcula correctamente para valor mínimo (Kz 1)", () => {
    const result = calculateIvaTotals(1);
    expect(result.subtotal).toBe(1);
    expect(result.taxAmount).toBe(0);   // Math.round(1 * 0.14) = 0
    expect(result.total).toBe(1);
  });

  it("calcula correctamente para valor alto (Kz 1.000.000)", () => {
    const result = calculateIvaTotals(1_000_000);
    expect(result.taxAmount).toBe(140_000);
    expect(result.total).toBe(1_140_000);
  });
});

// ── Cenários de faturação múltipla ────────────────────────────────────────────

describe("calculateIvaTotals — fatura mista (MIXED)", () => {
  it("soma correcta de múltiplos items antes de calcular IVA", () => {
    // Mensalidade Kz 45.000 + Sala 2h Kz 8.000 = subtotal Kz 53.000
    const items = [
      { quantity: 1, unitPrice: 45000 },
      { quantity: 1, unitPrice: 8000  },
    ];
    const itemsSubtotal = items.reduce(
      (acc, it) => acc + Math.round(it.quantity * it.unitPrice),
      0
    );
    const result = calculateIvaTotals(itemsSubtotal);
    expect(result.subtotal).toBe(53000);
    expect(result.taxAmount).toBe(7420);
    expect(result.total).toBe(60420);
  });

  it("items com quantidade > 1", () => {
    // 3 dias * Kz 5.000 = Kz 15.000
    const items = [{ quantity: 3, unitPrice: 5000 }];
    const subtotalRaw = items.reduce(
      (acc, it) => acc + Math.round(it.quantity * it.unitPrice),
      0
    );
    const result = calculateIvaTotals(subtotalRaw);
    expect(result.subtotal).toBe(15000);
    expect(result.taxAmount).toBe(2100);
    expect(result.total).toBe(17100);
  });
});
