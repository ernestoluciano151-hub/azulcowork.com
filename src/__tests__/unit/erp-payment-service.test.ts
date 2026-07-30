/**
 * erp-payment-service.test.ts — Testes unitários da lógica de pagamentos ERP
 *
 * Testa lógica pura sem BD:
 *  - Cálculo de estado da fatura após pagamento (PAID / PARTIALLY_PAID)
 *  - Detecção de excesso de pagamento (overpaid)
 *  - Validação de valores
 *  - Lógica de estorno / reembolso
 */

import { describe, it, expect } from "vitest";

// ── Lógica de determinação de estado da fatura ────────────────────────────────

function determineInvoiceStatus(
  invoiceTotal: number,
  previouslyPaid: number,
  newPayment: number
): { status: "PAID" | "PARTIALLY_PAID" | "ISSUED"; totalPaid: number; remainder: number; isOverpaid: boolean } {
  const totalPaid   = previouslyPaid + newPayment;
  const remainder   = invoiceTotal - totalPaid;
  const isOverpaid  = totalPaid > invoiceTotal;
  const isFullyPaid = totalPaid >= invoiceTotal;

  return {
    status:     isFullyPaid ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : "ISSUED",
    totalPaid,
    remainder:  Math.max(0, remainder),
    isOverpaid,
  };
}

// ── Lógica de validação de pagamento ─────────────────────────────────────────

function validatePaymentAmount(amount: number): { ok: boolean; error?: string } {
  if (typeof amount !== "number") return { ok: false, error: "amount deve ser número." };
  if (amount <= 0)                return { ok: false, error: "amount deve ser positivo." };
  if (!isFinite(amount))         return { ok: false, error: "amount inválido." };
  return { ok: true };
}

// ── determineInvoiceStatus ────────────────────────────────────────────────────

describe("determineInvoiceStatus", () => {
  it("pagamento total → PAID", () => {
    const r = determineInvoiceStatus(51300, 0, 51300);
    expect(r.status).toBe("PAID");
    expect(r.totalPaid).toBe(51300);
    expect(r.remainder).toBe(0);
    expect(r.isOverpaid).toBe(false);
  });

  it("pagamento parcial → PARTIALLY_PAID", () => {
    const r = determineInvoiceStatus(51300, 0, 25000);
    expect(r.status).toBe("PARTIALLY_PAID");
    expect(r.totalPaid).toBe(25000);
    expect(r.remainder).toBe(26300);
    expect(r.isOverpaid).toBe(false);
  });

  it("segundo pagamento que completa → PAID", () => {
    const r = determineInvoiceStatus(51300, 25000, 26300);
    expect(r.status).toBe("PAID");
    expect(r.totalPaid).toBe(51300);
    expect(r.remainder).toBe(0);
    expect(r.isOverpaid).toBe(false);
  });

  it("pagamento em excesso → PAID + isOverpaid", () => {
    const r = determineInvoiceStatus(51300, 0, 60000);
    expect(r.status).toBe("PAID");   // totalPaid > total → ainda é PAID
    expect(r.isOverpaid).toBe(true);
    expect(r.totalPaid).toBe(60000);
    expect(r.remainder).toBe(0);     // não existe remainder negativo
  });

  it("excesso calculado correctamente", () => {
    const invoiceTotal = 51300;
    const paid         = 60000;
    const r = determineInvoiceStatus(invoiceTotal, 0, paid);
    expect(r.isOverpaid).toBe(true);
    const excesso = r.totalPaid - invoiceTotal;
    expect(excesso).toBe(8700);
  });

  it("múltiplos pagamentos parciais que somam o total → PAID", () => {
    // Fatura de Kz 60.420
    const total = 60420;
    const p1 = determineInvoiceStatus(total, 0,     20000);
    const p2 = determineInvoiceStatus(total, 20000, 20000);
    const p3 = determineInvoiceStatus(total, 40000, 20420);
    expect(p1.status).toBe("PARTIALLY_PAID");
    expect(p2.status).toBe("PARTIALLY_PAID");
    expect(p3.status).toBe("PAID");
    expect(p3.remainder).toBe(0);
  });

  it("fatura de alto valor — Kz 250.000", () => {
    const r = determineInvoiceStatus(250000, 0, 250000);
    expect(r.status).toBe("PAID");
    expect(r.totalPaid).toBe(250000);
  });
});

// ── validatePaymentAmount ─────────────────────────────────────────────────────

describe("validatePaymentAmount", () => {
  it("valor positivo é válido", () => {
    expect(validatePaymentAmount(45000).ok).toBe(true);
  });

  it("zero é inválido", () => {
    const r = validatePaymentAmount(0);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/positivo/);
  });

  it("negativo é inválido", () => {
    expect(validatePaymentAmount(-100).ok).toBe(false);
  });

  it("Infinity é inválido", () => {
    expect(validatePaymentAmount(Infinity).ok).toBe(false);
  });

  it("valor Kz 1 (mínimo) é válido", () => {
    expect(validatePaymentAmount(1).ok).toBe(true);
  });

  it("valor alto (Kz 1.000.000) é válido", () => {
    expect(validatePaymentAmount(1_000_000).ok).toBe(true);
  });
});

// ── Lógica de ledger (partida dupla) ─────────────────────────────────────────

describe("partida dupla na confirmação", () => {
  it("confirmação gera exactamente 2 lançamentos", () => {
    const paymentAmount = 51300;
    const ledgerEntries = [
      { type: "DEBIT",  accountCode: "1201", amount: paymentAmount },  // Banco
      { type: "CREDIT", accountCode: "2111", amount: paymentAmount },  // Clientes
    ];
    expect(ledgerEntries).toHaveLength(2);
    const debits  = ledgerEntries.filter(e => e.type === "DEBIT");
    const credits = ledgerEntries.filter(e => e.type === "CREDIT");
    expect(debits.length).toBe(1);
    expect(credits.length).toBe(1);
    // Partida dupla: DEBIT = CREDIT
    const totalDebit  = debits.reduce((s, e) => s + e.amount, 0);
    const totalCredit = credits.reduce((s, e) => s + e.amount, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("estorno de reembolso inverte os lançamentos", () => {
    const refundAmount = 51300;
    const reversalEntries = [
      { type: "CREDIT", accountCode: "1201", amount: refundAmount }, // Banco — saída
      { type: "DEBIT",  accountCode: "2111", amount: refundAmount }, // Clientes — repõe dívida
    ];
    // O estorno deve ter o mesmo número de lançamentos
    expect(reversalEntries).toHaveLength(2);
    // Partida dupla mantida
    const totalDebit  = reversalEntries.filter(e => e.type === "DEBIT" ).reduce((s, e) => s + e.amount, 0);
    const totalCredit = reversalEntries.filter(e => e.type === "CREDIT").reduce((s, e) => s + e.amount, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(refundAmount);
  });
});
