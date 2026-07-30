/**
 * erp-dashboard-service.test.ts — Testes unitários do serviço de dashboard ERP
 *
 * Testa lógica pura sem BD:
 *  - Cálculo de MRR / ARR
 *  - Churn rate
 *  - Ticket médio
 *  - Delinquency rate (%)
 *  - Gross margin %
 *  - EBIT (P&L)
 *  - MRR net = new - churn
 *  - Partida dupla — balancete equilibrado
 *  - CostCenter: status OK / WARNING / CRITICAL
 */

import { describe, it, expect } from "vitest";

// ── MRR / ARR ─────────────────────────────────────────────────────────────────

function calcMrr(contracts: { monthlyValue: number }[]): number {
  return Math.round(contracts.reduce((s, c) => s + c.monthlyValue, 0));
}

function calcArr(mrr: number): number {
  return mrr * 12;
}

describe("MRR / ARR", () => {
  it("MRR = soma dos monthlyValue dos contratos ACTIVE", () => {
    const contracts = [
      { monthlyValue: 150_000 },
      { monthlyValue: 200_000 },
      { monthlyValue:  75_000 },
    ];
    expect(calcMrr(contracts)).toBe(425_000);
  });

  it("ARR = MRR × 12", () => {
    expect(calcArr(425_000)).toBe(5_100_000);
  });

  it("MRR sem contratos = 0", () => {
    expect(calcMrr([])).toBe(0);
    expect(calcArr(0)).toBe(0);
  });

  it("MRR com 1 contrato", () => {
    expect(calcMrr([{ monthlyValue: 250_000 }])).toBe(250_000);
  });
});

// ── Churn Rate ────────────────────────────────────────────────────────────────

function calcChurnRate(churned: number, totalActive: number): number {
  if (totalActive <= 0) return 0;
  return Math.round((churned / totalActive) * 100);
}

describe("Churn Rate", () => {
  it("0 churned → 0%", () => {
    expect(calcChurnRate(0, 20)).toBe(0);
  });

  it("1 churned de 20 → 5%", () => {
    expect(calcChurnRate(1, 20)).toBe(5);
  });

  it("2 churned de 18 → 11%", () => {
    expect(calcChurnRate(2, 18)).toBe(11);  // Math.round(2/18*100) = 11
  });

  it("sem contratos activos → 0% (evita divisão por zero)", () => {
    expect(calcChurnRate(1, 0)).toBe(0);
  });
});

// ── Ticket Médio ──────────────────────────────────────────────────────────────

function calcAverageTicket(mrr: number, activeContracts: number): number {
  if (activeContracts <= 0) return 0;
  return Math.round(mrr / activeContracts);
}

describe("Ticket Médio", () => {
  it("MRR 450.000 com 3 contratos → Kz 150.000/cliente", () => {
    expect(calcAverageTicket(450_000, 3)).toBe(150_000);
  });

  it("0 contratos → 0 (sem divisão por zero)", () => {
    expect(calcAverageTicket(450_000, 0)).toBe(0);
  });

  it("arredondamento correcto", () => {
    // 425.000 / 3 = 141.666,7 → 141.667
    expect(calcAverageTicket(425_000, 3)).toBe(141_667);
  });
});

// ── Delinquency Rate ──────────────────────────────────────────────────────────

function calcDelinquencyRate(overdueAmount: number, revenue: number): number {
  if (revenue <= 0) return 0;
  return Math.round((overdueAmount / revenue) * 100);
}

describe("Delinquency Rate (%)", () => {
  it("sem receita → 0%", () => {
    expect(calcDelinquencyRate(50_000, 0)).toBe(0);
  });

  it("sem atraso → 0%", () => {
    expect(calcDelinquencyRate(0, 500_000)).toBe(0);
  });

  it("8% — exemplo do relatório", () => {
    // Kz 92.000 em atraso de Kz 1.145.000 faturado ≈ 8%
    expect(calcDelinquencyRate(92_000, 1_145_000)).toBe(8);
  });

  it("50% → alerta crítico", () => {
    expect(calcDelinquencyRate(250_000, 500_000)).toBe(50);
  });
});

// ── P&L — Gross Margin ────────────────────────────────────────────────────────

function calcGrossMargin(revenue: number, operationalCosts: number) {
  const grossMargin    = revenue - operationalCosts;
  const grossMarginPct = revenue > 0 ? Math.round((grossMargin / revenue) * 100) : 0;
  return { grossMargin, grossMarginPct };
}

describe("P&L — Gross Margin", () => {
  it("exemplo do relatório: receita 1.145.000, custos 600.000 → margem 47%", () => {
    const { grossMargin, grossMarginPct } = calcGrossMargin(1_145_000, 600_000);
    expect(grossMargin).toBe(545_000);
    expect(grossMarginPct).toBe(48); // Math.round(545/1145*100) = 48
  });

  it("margem negativa quando custos > receita", () => {
    const { grossMargin, grossMarginPct } = calcGrossMargin(400_000, 600_000);
    expect(grossMargin).toBe(-200_000);
    expect(grossMarginPct).toBe(-50);
  });

  it("receita zero → 0%", () => {
    const { grossMarginPct } = calcGrossMargin(0, 0);
    expect(grossMarginPct).toBe(0);
  });
});

// ── P&L — EBIT ────────────────────────────────────────────────────────────────

function calcEbit(
  grossMargin: number,
  personnelCosts: number,
  generalExpenses: number
): number {
  return grossMargin - personnelCosts - generalExpenses;
}

describe("P&L — EBIT", () => {
  it("exemplo do relatório: margem 545k - pessoal 368k - gerais 190k = -13k", () => {
    expect(calcEbit(545_000, 368_000, 190_000)).toBe(-13_000);
  });

  it("EBIT positivo quando despesas baixas", () => {
    expect(calcEbit(700_000, 300_000, 150_000)).toBe(250_000);
  });

  it("EBIT = grossMargin sem despesas gerais", () => {
    expect(calcEbit(500_000, 0, 0)).toBe(500_000);
  });
});

// ── MRR Breakdown — net MRR ────────────────────────────────────────────────────

function calcNetMrr(newMrr: number, churnMrr: number, expansionMrr = 0, contractionMrr = 0): number {
  return newMrr + expansionMrr - churnMrr - contractionMrr;
}

describe("MRR Breakdown — net MRR", () => {
  it("net = new - churn (sem expansão/contracção)", () => {
    expect(calcNetMrr(100_000, 50_000)).toBe(50_000);
  });

  it("net negativo quando churn > new", () => {
    expect(calcNetMrr(50_000, 100_000)).toBe(-50_000);
  });

  it("sem movimento → net = 0", () => {
    expect(calcNetMrr(0, 0)).toBe(0);
  });

  it("com expansão: net = new + expansion - churn", () => {
    expect(calcNetMrr(80_000, 30_000, 20_000)).toBe(70_000);
  });
});

// ── Balancete — partida dupla equilibrada ──────────────────────────────────────

describe("Balancete — partida dupla sempre equilibrada", () => {
  type LedgerEntry = { type: "DEBIT" | "CREDIT"; amount: number };

  function isBalanced(entries: LedgerEntry[]): boolean {
    const totalDebit  = entries.filter(e => e.type === "DEBIT" ).reduce((s, e) => s + e.amount, 0);
    const totalCredit = entries.filter(e => e.type === "CREDIT").reduce((s, e) => s + e.amount, 0);
    return totalDebit === totalCredit;
  }

  it("emissão de fatura equilibrada (2111 = 7xxx + 2311)", () => {
    const entries: LedgerEntry[] = [
      { type: "DEBIT",  amount: 114_000 }, // 2111 Clientes
      { type: "CREDIT", amount: 100_000 }, // 7111 Proveitos
      { type: "CREDIT", amount:  14_000 }, // 2311 IVA a pagar
    ];
    expect(isBalanced(entries)).toBe(true);
  });

  it("confirmação de pagamento equilibrada (1201 = 2111)", () => {
    const entries: LedgerEntry[] = [
      { type: "DEBIT",  amount: 114_000 }, // 1201 Banco
      { type: "CREDIT", amount: 114_000 }, // 2111 Clientes
    ];
    expect(isBalanced(entries)).toBe(true);
  });

  it("pagamento de despesa equilibrado (6xxx = 1201)", () => {
    const entries: LedgerEntry[] = [
      { type: "DEBIT",  amount: 45_000 }, // 6121 Electricidade
      { type: "CREDIT", amount: 45_000 }, // 1201 Banco
    ];
    expect(isBalanced(entries)).toBe(true);
  });

  it("entradas desequilibradas → não equilibrado", () => {
    const entries: LedgerEntry[] = [
      { type: "DEBIT",  amount: 100_000 },
      { type: "CREDIT", amount:  90_000 }, // falta 10k
    ];
    expect(isBalanced(entries)).toBe(false);
  });
});

// ── CostCenter Status ─────────────────────────────────────────────────────────

function ccStatus(actual: number, budget: number | null): "OK" | "WARNING" | "CRITICAL" | "NO_BUDGET" {
  if (!budget || budget <= 0) return "NO_BUDGET";
  const ratio = actual / budget;
  if (ratio >= 1.30) return "CRITICAL";
  if (ratio >= 1.15) return "WARNING";
  return "OK";
}

describe("CostCenter — status orçamental", () => {
  it("dentro do orçamento → OK", () => {
    expect(ccStatus(95_000, 100_000)).toBe("OK");
  });

  it("+15% → WARNING", () => {
    expect(ccStatus(115_000, 100_000)).toBe("WARNING");
  });

  it("+30% → CRITICAL", () => {
    expect(ccStatus(130_000, 100_000)).toBe("CRITICAL");
  });

  it("sem orçamento (null) → NO_BUDGET", () => {
    expect(ccStatus(50_000, null)).toBe("NO_BUDGET");
  });

  it("centro FINANCEIRO sem orçamento → NO_BUDGET", () => {
    // O centro FINANCEIRO não tem budget definido no MVP
    expect(ccStatus(0, null)).toBe("NO_BUDGET");
  });
});
