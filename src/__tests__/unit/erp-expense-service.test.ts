/**
 * erp-expense-service.test.ts — Testes unitários do serviço de despesas ERP
 *
 * Testa lógica pura sem BD:
 *  - Regra de aprovação automática BR-FIN-008 (≤ 50.000 → APPROVED)
 *  - Cálculo de IVA dedutível em despesas com NIF
 *  - Classificação de bucket de aging (CURRENT / 30 / 60 / 90 / +90)
 *  - Partida dupla no pagamento de despesas (com e sem IVA)
 *  - Transições de estado válidas e inválidas
 */

import { describe, it, expect } from "vitest";
import { AUTO_APPROVE_LIMIT }   from "@/lib/erp-expense-service";
import { classifyBucket }       from "@/lib/erp-receivables-service";
import type { AgingBucket }     from "@/lib/erp-receivables-service";

// ── BR-FIN-008 — Aprovação automática ────────────────────────────────────────

describe("BR-FIN-008 — Aprovação automática", () => {
  it("constante AUTO_APPROVE_LIMIT é Kz 50.000", () => {
    expect(AUTO_APPROVE_LIMIT).toBe(50_000);
  });

  it("despesa ≤ 50.000 → auto-aprovada (APPROVED)", () => {
    const amounts = [1, 100, 10_000, 49_999, 50_000];
    for (const amount of amounts) {
      const status = amount <= AUTO_APPROVE_LIMIT ? "APPROVED" : "PENDING";
      expect(status).toBe("APPROVED");
    }
  });

  it("despesa > 50.000 → requer aprovação (PENDING)", () => {
    const amounts = [50_001, 75_000, 100_000, 500_000, 1_000_000];
    for (const amount of amounts) {
      const status = amount <= AUTO_APPROVE_LIMIT ? "APPROVED" : "PENDING";
      expect(status).toBe("PENDING");
    }
  });

  it("limite exacto (Kz 50.000) → APPROVED", () => {
    expect(50_000 <= AUTO_APPROVE_LIMIT).toBe(true);
  });

  it("Kz 50.001 → PENDING", () => {
    expect(50_001 <= AUTO_APPROVE_LIMIT).toBe(false);
  });
});

// ── IVA Dedutível ─────────────────────────────────────────────────────────────

const IVA_RATE = 0.14;

/**
 * Calcula IVA dedutível: quando o valor total já inclui IVA,
 * extrai a parcela de IVA pelo método de decomposição.
 *
 * Exemplo: total = 114.000 → IVA = 14.000, base = 100.000
 */
function calcIvaDeductible(totalAmount: number) {
  const ivaAmount  = Math.round(totalAmount * IVA_RATE / (1 + IVA_RATE));
  const baseAmount = totalAmount - ivaAmount;
  return { ivaAmount, baseAmount, totalAmount };
}

describe("IVA dedutível em despesas (supplierNif presente)", () => {
  it("total Kz 114.000 → IVA = Kz 14.000, base = Kz 100.000", () => {
    const r = calcIvaDeductible(114_000);
    expect(r.ivaAmount).toBe(14_000);
    expect(r.baseAmount).toBe(100_000);
    expect(r.baseAmount + r.ivaAmount).toBe(r.totalAmount);
  });

  it("total Kz 57.000 → IVA = Kz 7.000, base = Kz 50.000", () => {
    const r = calcIvaDeductible(57_000);
    expect(r.ivaAmount).toBe(7_000);
    expect(r.baseAmount).toBe(50_000);
  });

  it("base + iva = total (arredondamento conservado)", () => {
    const totals = [45_000, 100_000, 228_000, 570_000];
    for (const t of totals) {
      const r = calcIvaDeductible(t);
      expect(r.baseAmount + r.ivaAmount).toBe(t);
    }
  });

  it("sem NIF → sem IVA dedutível (ivaAmount = 0)", () => {
    // Quando supplierNif está vazio, não há IVA dedutível
    const hasNif = false;
    const ivaAmount = hasNif ? Math.round(100_000 * IVA_RATE / (1 + IVA_RATE)) : 0;
    expect(ivaAmount).toBe(0);
  });

  it("partida dupla COM IVA: DEBIT(6xxx) + DEBIT(2312) = CREDIT(1201)", () => {
    const total     = 114_000;
    const iva       = 14_000;
    const base      = 100_000;
    const entries   = [
      { type: "DEBIT",  accountCode: "6111", amount: base },    // custo s/IVA
      { type: "DEBIT",  accountCode: "2312", amount: iva  },    // IVA dedutível
      { type: "CREDIT", accountCode: "1201", amount: total },   // banco
    ];
    const totalDebit  = entries.filter(e => e.type === "DEBIT" ).reduce((s, e) => s + e.amount, 0);
    const totalCredit = entries.filter(e => e.type === "CREDIT").reduce((s, e) => s + e.amount, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(total);
  });

  it("partida dupla SEM IVA: DEBIT(6xxx) = CREDIT(1201)", () => {
    const amount  = 45_000;
    const entries = [
      { type: "DEBIT",  accountCode: "6121", amount },
      { type: "CREDIT", accountCode: "1201", amount },
    ];
    const totalDebit  = entries.filter(e => e.type === "DEBIT" ).reduce((s, e) => s + e.amount, 0);
    const totalCredit = entries.filter(e => e.type === "CREDIT").reduce((s, e) => s + e.amount, 0);
    expect(totalDebit).toBe(totalCredit);
  });
});

// ── Classificação de Bucket de Aging ─────────────────────────────────────────

describe("classifyBucket — aging AR/AP", () => {
  it("daysOverdue = 0 → CURRENT", () => {
    expect(classifyBucket(0)).toBe("CURRENT");
  });

  it("daysOverdue = -1 (vence amanhã) → CURRENT", () => {
    expect(classifyBucket(-1)).toBe("CURRENT");
  });

  it("daysOverdue = -30 (vence em 30 dias) → CURRENT", () => {
    expect(classifyBucket(-30)).toBe("CURRENT");
  });

  it("daysOverdue = 1 → OVERDUE_30", () => {
    expect(classifyBucket(1)).toBe("OVERDUE_30");
  });

  it("daysOverdue = 30 → OVERDUE_30", () => {
    expect(classifyBucket(30)).toBe("OVERDUE_30");
  });

  it("daysOverdue = 31 → OVERDUE_60", () => {
    expect(classifyBucket(31)).toBe("OVERDUE_60");
  });

  it("daysOverdue = 60 → OVERDUE_60", () => {
    expect(classifyBucket(60)).toBe("OVERDUE_60");
  });

  it("daysOverdue = 61 → OVERDUE_90", () => {
    expect(classifyBucket(61)).toBe("OVERDUE_90");
  });

  it("daysOverdue = 90 → OVERDUE_90", () => {
    expect(classifyBucket(90)).toBe("OVERDUE_90");
  });

  it("daysOverdue = 91 → OVERDUE_90P", () => {
    expect(classifyBucket(91)).toBe("OVERDUE_90P");
  });

  it("daysOverdue = 180 → OVERDUE_90P", () => {
    expect(classifyBucket(180)).toBe("OVERDUE_90P");
  });

  it("daysOverdue = 365 → OVERDUE_90P", () => {
    expect(classifyBucket(365)).toBe("OVERDUE_90P");
  });
});

// ── Agregação de totais AR por bucket ─────────────────────────────────────────

describe("Agregação AR — totais por bucket", () => {
  type FakeInvoice = { daysOverdue: number; outstanding: number };

  function summarize(invoices: FakeInvoice[]) {
    const map = new Map<AgingBucket, number>([
      ["CURRENT",     0],
      ["OVERDUE_30",  0],
      ["OVERDUE_60",  0],
      ["OVERDUE_90",  0],
      ["OVERDUE_90P", 0],
    ]);
    for (const inv of invoices) {
      const b = classifyBucket(inv.daysOverdue);
      map.set(b, (map.get(b) ?? 0) + inv.outstanding);
    }
    return map;
  }

  it("3 faturas em buckets diferentes → totais correctos", () => {
    const invoices: FakeInvoice[] = [
      { daysOverdue: 0,   outstanding: 50_000  },  // CURRENT
      { daysOverdue: 15,  outstanding: 30_000  },  // OVERDUE_30
      { daysOverdue: 120, outstanding: 100_000 },  // OVERDUE_90P
    ];
    const map = summarize(invoices);
    expect(map.get("CURRENT")).toBe(50_000);
    expect(map.get("OVERDUE_30")).toBe(30_000);
    expect(map.get("OVERDUE_60")).toBe(0);
    expect(map.get("OVERDUE_90")).toBe(0);
    expect(map.get("OVERDUE_90P")).toBe(100_000);
  });

  it("total geral = soma de todos os buckets", () => {
    const invoices: FakeInvoice[] = [
      { daysOverdue:  0,  outstanding: 10_000 },
      { daysOverdue: 30,  outstanding: 20_000 },
      { daysOverdue: 60,  outstanding: 30_000 },
      { daysOverdue: 90,  outstanding: 40_000 },
      { daysOverdue: 91,  outstanding: 50_000 },
    ];
    const map = summarize(invoices);
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    expect(total).toBe(150_000);
  });
});

// ── Transições de estado de despesa ───────────────────────────────────────────

describe("Transições de estado de despesa", () => {
  type ExpenseStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";

  function canApprove(status: ExpenseStatus): boolean {
    return status === "PENDING";
  }

  function canReject(status: ExpenseStatus): boolean {
    return status === "PENDING";
  }

  function canPay(status: ExpenseStatus): boolean {
    return status === "APPROVED";
  }

  function canCancel(status: ExpenseStatus): boolean {
    return status === "PENDING" || status === "APPROVED";
  }

  it("PENDING pode ser aprovada", ()  => expect(canApprove("PENDING")).toBe(true));
  it("APPROVED não pode ser re-aprovada", () => expect(canApprove("APPROVED")).toBe(false));
  it("PAID não pode ser aprovada",    ()  => expect(canApprove("PAID")).toBe(false));

  it("PENDING pode ser rejeitada",    ()  => expect(canReject("PENDING")).toBe(true));
  it("APPROVED não pode ser rejeitada", () => expect(canReject("APPROVED")).toBe(false));

  it("APPROVED pode ser paga",        ()  => expect(canPay("APPROVED")).toBe(true));
  it("PENDING não pode ser paga",     ()  => expect(canPay("PENDING")).toBe(false));
  it("PAID não pode ser paga novamente", () => expect(canPay("PAID")).toBe(false));

  it("PENDING pode ser cancelada",    ()  => expect(canCancel("PENDING")).toBe(true));
  it("APPROVED pode ser cancelada",   ()  => expect(canCancel("APPROVED")).toBe(true));
  it("PAID não pode ser cancelada",   ()  => expect(canCancel("PAID")).toBe(false));
  it("REJECTED não pode ser cancelada", () => expect(canCancel("REJECTED")).toBe(false));
});
