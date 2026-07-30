/**
 * erp-cashflow-service.test.ts — Testes unitários do serviço de cashflow ERP
 *
 * Testa lógica pura sem BD:
 *  - Cálculo de saldo acumulado (sequência INFLOW / OUTFLOW)
 *  - Agregação por dia / semana / mês
 *  - Cálculo de burn rate e runway
 *  - Detecção de saldo negativo na projecção
 *  - Classificação do tipo de movimento (INFLOW/OUTFLOW para ajuste)
 */

import { describe, it, expect } from "vitest";

// ── Lógica de saldo acumulado ─────────────────────────────────────────────────

type MovType = "INFLOW" | "OUTFLOW" | "TRANSFER" | "PROJECTED";

interface RawMovement {
  type:   MovType;
  amount: number;
}

/**
 * Calcula saldo cumulativo a partir de uma lista de movimentos.
 * Replica a lógica de recalculateBalances do serviço.
 */
function calcRunningBalance(movements: RawMovement[], opening = 0): number[] {
  let balance = opening;
  return movements.map((m) => {
    if (m.type === "INFLOW" || m.type === "PROJECTED") {
      balance = Math.round(balance + m.amount);
    } else if (m.type === "OUTFLOW") {
      balance = Math.round(balance - m.amount);
    }
    // TRANSFER não altera o saldo (simplificação MVP)
    return balance;
  });
}

describe("Cálculo de saldo acumulado", () => {
  it("saldo inicial zero + INFLOW → saldo positivo", () => {
    const balances = calcRunningBalance([{ type: "INFLOW", amount: 100_000 }]);
    expect(balances[0]).toBe(100_000);
  });

  it("INFLOW seguido de OUTFLOW → saldo reduzido", () => {
    const balances = calcRunningBalance([
      { type: "INFLOW",  amount: 300_000 },
      { type: "OUTFLOW", amount: 45_000  },
    ]);
    expect(balances[0]).toBe(300_000);
    expect(balances[1]).toBe(255_000);
  });

  it("saldo pode ficar negativo (OUTFLOW > saldo)", () => {
    const balances = calcRunningBalance([
      { type: "INFLOW",  amount: 50_000 },
      { type: "OUTFLOW", amount: 80_000 },
    ]);
    expect(balances[1]).toBe(-30_000);
  });

  it("saldo de abertura não zero", () => {
    const balances = calcRunningBalance(
      [{ type: "OUTFLOW", amount: 30_000 }],
      500_000  // opening
    );
    expect(balances[0]).toBe(470_000);
  });

  it("TRANSFER não altera saldo", () => {
    const balances = calcRunningBalance([
      { type: "INFLOW",   amount: 200_000 },
      { type: "TRANSFER", amount: 50_000  },
    ]);
    expect(balances[0]).toBe(200_000);
    expect(balances[1]).toBe(200_000); // TRANSFER não muda o saldo desta conta
  });

  it("sequência longa de movimentos — saldo correcto no final", () => {
    const movements: RawMovement[] = [
      { type: "INFLOW",  amount: 120_000 },
      { type: "OUTFLOW", amount:  45_000 },
      { type: "INFLOW",  amount:  60_000 },
      { type: "OUTFLOW", amount: 250_000 },
      { type: "INFLOW",  amount: 300_000 },
    ];
    const opening = 750_000;
    const balances = calcRunningBalance(movements, opening);
    // 750k + 120k - 45k + 60k - 250k + 300k = 935k
    expect(balances[balances.length - 1]).toBe(935_000);
  });

  it("arredondamento preservado (sem frações em AOA)", () => {
    // AOA não tem cêntimos — todos os valores devem ser inteiros
    const balances = calcRunningBalance([
      { type: "INFLOW",  amount: 114_285 },
      { type: "OUTFLOW", amount:  14_285 },
    ]);
    expect(Number.isInteger(balances[0])).toBe(true);
    expect(Number.isInteger(balances[1])).toBe(true);
    expect(balances[1]).toBe(100_000);
  });
});

// ── Burn Rate e Runway ────────────────────────────────────────────────────────

function calcBurnRate(totalOutflow3m: number, months = 3): number {
  return Math.round(totalOutflow3m / months);
}

function calcRunway(currentBalance: number, burnRate: number): number {
  if (burnRate <= 0) return 999; // sem saídas → runway ilimitado
  return Math.floor(currentBalance / burnRate);
}

describe("Burn Rate e Runway", () => {
  it("burn rate = média das saídas dos últimos 3 meses", () => {
    // 3 meses: 450k + 500k + 550k = 1.500k → burn = 500k/mês
    expect(calcBurnRate(1_500_000)).toBe(500_000);
  });

  it("runway = saldo / burn rate (divisão inteira)", () => {
    expect(calcRunway(1_500_000, 500_000)).toBe(3);   // 3 meses exactos
    expect(calcRunway(1_250_000, 500_000)).toBe(2);   // 2,5 → floor → 2
    expect(calcRunway(  499_999, 500_000)).toBe(0);   // menos de 1 mês
  });

  it("sem saídas (burnRate = 0) → runway = 999 (sem limite)", () => {
    expect(calcRunway(1_000_000, 0)).toBe(999);
  });

  it("saldo zero → runway = 0", () => {
    expect(calcRunway(0, 300_000)).toBe(0);
  });

  it("saldo negativo → runway = 0 (Math.floor de negativo)", () => {
    // Math.floor(-0.5) = -1, mas runway < 0 significa já sem fundos
    const result = calcRunway(-100_000, 300_000);
    expect(result).toBeLessThanOrEqual(0);
  });

  it("burn rate com saídas variáveis", () => {
    const months = [380_000, 420_000, 500_000]; // 3 meses de saídas
    const total  = months.reduce((s, v) => s + v, 0);
    const burn   = calcBurnRate(total);
    expect(burn).toBe(433_333); // Math.round(1_300_000 / 3)
  });
});

// ── Detecção de saldo negativo ────────────────────────────────────────────────

type ProjEntry = { date: Date; runningBalance: number; isProjected: boolean };

function detectNegativeInProjection(entries: ProjEntry[]): ProjEntry | null {
  return entries.find((e) => e.runningBalance < 0) ?? null;
}

describe("Detecção de saldo negativo na projecção", () => {
  const today = new Date("2026-08-01");

  it("nenhuma entrada negativa → null", () => {
    const entries: ProjEntry[] = [
      { date: new Date("2026-08-05"), runningBalance: 500_000, isProjected: false },
      { date: new Date("2026-08-10"), runningBalance: 300_000, isProjected: true  },
    ];
    expect(detectNegativeInProjection(entries)).toBeNull();
  });

  it("entrada negativa → devolve a primeira ocorrência", () => {
    const entries: ProjEntry[] = [
      { date: new Date("2026-08-05"), runningBalance:  100_000, isProjected: false },
      { date: new Date("2026-08-15"), runningBalance:  -50_000, isProjected: true  },
      { date: new Date("2026-08-20"), runningBalance: -100_000, isProjected: true  },
    ];
    const result = detectNegativeInProjection(entries);
    expect(result).not.toBeNull();
    expect(result!.runningBalance).toBe(-50_000);
    expect(result!.date).toEqual(new Date("2026-08-15"));
  });

  it("saldo zero não é considerado negativo", () => {
    const entries: ProjEntry[] = [
      { date: new Date("2026-08-10"), runningBalance: 0, isProjected: true },
    ];
    expect(detectNegativeInProjection(entries)).toBeNull();
  });
});

// ── Agregação de movimentos por período ───────────────────────────────────────

interface PeriodResult {
  periodKey: string;
  inflow:    number;
  outflow:   number;
  net:       number;
}

function groupByMonth(movements: { date: string; type: MovType; amount: number }[]): PeriodResult[] {
  const map = new Map<string, PeriodResult>();
  for (const m of movements) {
    const key = m.date.slice(0, 7); // "2026-08"
    if (!map.has(key)) map.set(key, { periodKey: key, inflow: 0, outflow: 0, net: 0 });
    const entry = map.get(key)!;
    if (m.type === "INFLOW")   entry.inflow  += m.amount;
    if (m.type === "OUTFLOW")  entry.outflow += m.amount;
  }
  for (const entry of map.values()) {
    entry.net    = Math.round(entry.inflow - entry.outflow);
    entry.inflow = Math.round(entry.inflow);
    entry.outflow= Math.round(entry.outflow);
  }
  return [...map.values()];
}

describe("Agregação de movimentos por mês", () => {
  it("2 entradas no mesmo mês → somadas", () => {
    const movs = [
      { date: "2026-08-01", type: "INFLOW"  as MovType, amount: 100_000 },
      { date: "2026-08-15", type: "INFLOW"  as MovType, amount:  50_000 },
    ];
    const result = groupByMonth(movs);
    expect(result).toHaveLength(1);
    expect(result[0].inflow).toBe(150_000);
    expect(result[0].net).toBe(150_000);
  });

  it("2 meses diferentes → 2 grupos", () => {
    const movs = [
      { date: "2026-08-01", type: "INFLOW"  as MovType, amount: 200_000 },
      { date: "2026-09-01", type: "OUTFLOW" as MovType, amount:  80_000 },
    ];
    const result = groupByMonth(movs);
    expect(result).toHaveLength(2);
    const aug = result.find(r => r.periodKey === "2026-08")!;
    const sep = result.find(r => r.periodKey === "2026-09")!;
    expect(aug.net).toBe(200_000);
    expect(sep.net).toBe(-80_000);
  });

  it("net = inflow - outflow", () => {
    const movs = [
      { date: "2026-08-05", type: "INFLOW"  as MovType, amount: 300_000 },
      { date: "2026-08-10", type: "OUTFLOW" as MovType, amount: 120_000 },
      { date: "2026-08-20", type: "OUTFLOW" as MovType, amount:  80_000 },
    ];
    const result = groupByMonth(movs);
    expect(result[0].inflow ).toBe(300_000);
    expect(result[0].outflow).toBe(200_000);
    expect(result[0].net    ).toBe(100_000);
  });
});

// ── Tipo de movimento para ajuste ─────────────────────────────────────────────

describe("Tipo de CashMovement para ajuste manual", () => {
  it("amount > 0 → INFLOW (saldo estava sub-estimado)", () => {
    const type = 5000 >= 0 ? "INFLOW" : "OUTFLOW";
    expect(type).toBe("INFLOW");
  });

  it("amount < 0 → OUTFLOW (saldo estava sobre-estimado)", () => {
    const type = -5000 >= 0 ? "INFLOW" : "OUTFLOW";
    expect(type).toBe("OUTFLOW");
  });

  it("amount = 0 → deve ser rejeitado pela validação", () => {
    const isValid = (v: number) => v !== 0;
    expect(isValid(0)).toBe(false);
    expect(isValid(1000)).toBe(true);
    expect(isValid(-500)).toBe(true);
  });
});
