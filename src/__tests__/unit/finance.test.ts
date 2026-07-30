/**
 * finance.test.ts — Testes unitários de src/lib/finance.ts
 *
 * Cobre:
 *  - calcContractMonths
 *  - calcTotalContracted
 *  - calcFinancialStatus
 *  - fmtAOA
 *  - getCompanyFinanceSummary (com mock de DbClient)
 *  - separação cowork vs sala (RFT-009)
 */

import { describe, it, expect, vi } from "vitest";
import {
  calcContractMonths,
  calcTotalContracted,
  calcFinancialStatus,
  fmtAOA,
  getCompanyFinanceSummary,
} from "@/lib/finance";
import { createPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { company, makeCoworkPayment, makeSalaPayment } from "@/__tests__/helpers/fixtures";

// ─────────────────────────────────────────────
// calcContractMonths
// ─────────────────────────────────────────────
describe("calcContractMonths", () => {
  it("contrato de 12 meses (Jan–Dez) = 12", () => {
    expect(calcContractMonths(new Date("2026-01-01"), new Date("2026-12-31"))).toBe(12);
  });

  it("contrato de 1 mês (mesmo mês) = 1", () => {
    expect(calcContractMonths(new Date("2026-06-01"), new Date("2026-06-30"))).toBe(1);
  });

  it("contrato de 6 meses = 6", () => {
    expect(calcContractMonths(new Date("2026-01-01"), new Date("2026-06-30"))).toBe(6);
  });

  it("mínimo é sempre 1 (mesmo com datas invertidas)", () => {
    expect(calcContractMonths(new Date("2026-06-01"), new Date("2026-01-01"))).toBe(1);
  });

  it("contrato de 24 meses = 24", () => {
    expect(calcContractMonths(new Date("2025-01-01"), new Date("2026-12-31"))).toBe(24);
  });
});

// ─────────────────────────────────────────────
// calcTotalContracted
// ─────────────────────────────────────────────
describe("calcTotalContracted", () => {
  it("150.000 AOA × 12 meses = 1.800.000 AOA", () => {
    expect(calcTotalContracted(150000, new Date("2026-01-01"), new Date("2026-12-31")))
      .toBe(1800000);
  });

  it("100.000 AOA × 6 meses = 600.000 AOA", () => {
    expect(calcTotalContracted(100000, new Date("2026-01-01"), new Date("2026-06-30")))
      .toBe(600000);
  });

  it("75.500 AOA × 3 meses = 226.500 AOA", () => {
    expect(calcTotalContracted(75500, new Date("2026-01-01"), new Date("2026-03-31")))
      .toBe(226500);
  });

  it("valor com decimais — resultado arredondado a 2 casas", () => {
    const result = calcTotalContracted(33333.33, new Date("2026-01-01"), new Date("2026-03-31"));
    expect(result).toBeCloseTo(99999.99, 1);
  });
});

// ─────────────────────────────────────────────
// calcFinancialStatus
// ─────────────────────────────────────────────
describe("calcFinancialStatus", () => {
  it("LIQUIDADO quando totalPaid >= totalContracted", () => {
    expect(calcFinancialStatus(1800000, 1800000)).toBe("LIQUIDADO");
  });

  it("LIQUIDADO quando totalPaid > totalContracted (overpayment)", () => {
    expect(calcFinancialStatus(1800000, 2000000)).toBe("LIQUIDADO");
  });

  it("PAGO_PARCIALMENTE quando pago > 0 mas < contratado", () => {
    expect(calcFinancialStatus(1800000, 900000)).toBe("PAGO_PARCIALMENTE");
  });

  it("EM_ATRASO quando nada pago e flag de atraso activa", () => {
    expect(calcFinancialStatus(1800000, 0, true)).toBe("EM_ATRASO");
  });

  it("PENDENTE quando nada pago e sem atraso", () => {
    expect(calcFinancialStatus(1800000, 0, false)).toBe("PENDENTE");
  });

  it("PENDENTE por defeito quando flag de atraso não fornecida", () => {
    expect(calcFinancialStatus(1800000, 0)).toBe("PENDENTE");
  });
});

// ─────────────────────────────────────────────
// fmtAOA
// ─────────────────────────────────────────────
describe("fmtAOA", () => {
  it("formata valor com sufixo AOA", () => {
    const result = fmtAOA(150000);
    expect(result).toContain("AOA");
    expect(result).toContain("150");
  });

  it("formata zero", () => {
    const result = fmtAOA(0);
    expect(result).toContain("0");
    expect(result).toContain("AOA");
  });

  it("formata valor com decimais", () => {
    const result = fmtAOA(1234.56);
    expect(result).toContain("AOA");
  });
});

// ─────────────────────────────────────────────
// getCompanyFinanceSummary — funções puras
// ─────────────────────────────────────────────
describe("getCompanyFinanceSummary", () => {
  it("retorna null quando empresa não existe", async () => {
    const db = createPrismaMock();
    (db.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await getCompanyFinanceSummary(db, "non-existent");
    expect(result).toBeNull();
  });

  it("calcula totalPaid usando apenas pagamentos de coworking (RFT-009)", async () => {
    const db = createPrismaMock();
    const coworkPay = makeCoworkPayment({ amount: 150000 });
    const salaPay   = makeSalaPayment({ amount: 75000 });

    (db.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...company,
      payments:        [coworkPay, salaPay],
      invoices:        [],
      financialHistory: [],
    });

    const result = await getCompanyFinanceSummary(db, "cmp-001");

    expect(result).not.toBeNull();
    // totalPaid deve incluir apenas cowork (150.000), não sala (75.000)
    expect(result!.totalPaid).toBe(150000);
    expect(result!.totalSala).toBe(75000);
  });

  it("separa coworkPayments e salaPayments correctamente", async () => {
    const db = createPrismaMock();
    const p1 = makeCoworkPayment({ id: "p1", amount: 150000 });
    const p2 = makeSalaPayment({ id: "p2", amount: 50000 });
    const p3 = makeCoworkPayment({ id: "p3", amount: 150000 });

    (db.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...company,
      payments:        [p1, p2, p3],
      invoices:        [],
      financialHistory: [],
    });

    const result = await getCompanyFinanceSummary(db, "cmp-001");

    expect(result!.coworkPayments).toHaveLength(2);
    expect(result!.salaPayments).toHaveLength(1);
  });

  it("balance = totalContracted - totalPaid (apenas cowork)", async () => {
    const db = createPrismaMock();
    const coworkPay = makeCoworkPayment({ amount: 300000 }); // 2 meses pagos
    const salaPay   = makeSalaPayment({ amount: 999999 });  // sala não afecta balance

    (db.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...company,
      contractStart: new Date("2026-01-01"),
      contractEnd:   new Date("2026-12-31"),
      rentAmount:    150000,
      payments:        [coworkPay, salaPay],
      invoices:        [],
      financialHistory: [],
    });

    const result = await getCompanyFinanceSummary(db, "cmp-001");
    const expectedContracted = 150000 * 12; // 1.800.000
    const expectedBalance    = expectedContracted - 300000; // 1.500.000

    expect(result!.totalContracted).toBe(expectedContracted);
    expect(result!.balance).toBe(expectedBalance);
  });

  it("financialStatus = LIQUIDADO quando totalPaid >= totalContracted", async () => {
    const db = createPrismaMock();
    const totalContracted = 150000 * 12; // 1.800.000
    const coworkPay = makeCoworkPayment({ amount: totalContracted });

    (db.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...company,
      contractStart: new Date("2026-01-01"),
      contractEnd:   new Date("2026-12-31"),
      rentAmount:    150000,
      payments:        [coworkPay],
      invoices:        [],
      financialHistory: [],
    });

    const result = await getCompanyFinanceSummary(db, "cmp-001");
    expect(result!.financialStatus).toBe("LIQUIDADO");
  });

  it("isOverdue considera apenas pagamentos de cowork em atraso", async () => {
    const db = createPrismaMock();
    // Sala em atraso NÃO deve afectar isOverdue do contrato de coworking
    const salaPendente = makeSalaPayment({
      status: "PENDENTE",
      dueDate: new Date("2020-01-01"), // data no passado
    });
    // Cowork em dia
    const coworkPago = makeCoworkPayment({ status: "PAGO" });

    (db.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...company,
      payments: [salaPendente, coworkPago],
      invoices: [],
      financialHistory: [],
    });

    const result = await getCompanyFinanceSummary(db, "cmp-001");
    // coworkPayments: só coworkPago (status PAGO) → isOverdue = false
    expect(result!.financialStatus).not.toBe("EM_ATRASO");
  });

  it("devolve months correctamente", async () => {
    const db = createPrismaMock();

    (db.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...company,
      contractStart: new Date("2026-01-01"),
      contractEnd:   new Date("2026-06-30"),
      payments: [],
      invoices: [],
      financialHistory: [],
    });

    const result = await getCompanyFinanceSummary(db, "cmp-001");
    expect(result!.months).toBe(6);
  });
});
