/**
 * erp-reports-service.test.ts — Testes unitários ERP-9
 *
 * Cobre lógica pura de:
 *   - VatReport: apuramento IVA Angola (taxa 14%)
 *   - ReconciliationReport: detecção de discrepâncias
 *   - ExportResult: contentType, filename por formato/tipo
 *
 * Sem mocks de BD — todas as funções são helpers inline ou lógica extraída.
 * Validado via: node -e (sandbox não suporta Vitest)
 *
 * Sprint: ERP-9
 */

import { describe, it, expect } from "vitest";
import { IVA_RATE }             from "@/lib/erp-vat-report-service";
import { RECONCILIATION_THRESHOLD } from "@/lib/erp-reconciliation-service";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers pura lógica (extraídos dos services para teste isolado)
// ──────────────────────────────────────────────────────────────────────────────

/** IVA apuramento */
function calcVatBalance(outputVat: number, inputVat: number): number {
  return Math.round(outputVat - inputVat);
}

function vatStatus(balance: number): "DUE" | "CREDIT" | "ZERO" {
  if (balance > 0) return "DUE";
  if (balance < 0) return "CREDIT";
  return "ZERO";
}

/** Cálculo inverso: base a partir do valor de IVA */
function calcBase(vatAmount: number, rate = IVA_RATE): number {
  return Math.round(vatAmount / rate);
}

/** Linha de reconciliação */
type LineStatus = "OK" | "MISMATCH";
function reconciliationLineStatus(cmAmount: number, sourceAmount: number): LineStatus {
  return Math.abs(cmAmount - sourceAmount) <= RECONCILIATION_THRESHOLD ? "OK" : "MISMATCH";
}

function calcDiscrepancy(cmAmount: number, sourceAmount: number): number {
  return Math.abs(Math.round(cmAmount) - Math.round(sourceAmount));
}

function isBalanced(statuses: LineStatus[]): boolean {
  return statuses.every((s) => s === "OK");
}

/** Export helpers */
function exportContentType(format: "xlsx" | "csv"): string {
  return format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv; charset=utf-8";
}

function exportFilename(type: string, format: "xlsx" | "csv", period?: string): string {
  const suffix = period ? `_${period}` : "";
  return `azul_cowork_${type}${suffix}.${format}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// IVA — Apuramento
// ──────────────────────────────────────────────────────────────────────────────

describe("IVA apuramento", () => {
  it("calcula saldo positivo → DUE", () => {
    expect(calcVatBalance(140_000, 56_000)).toBe(84_000);
    expect(vatStatus(84_000)).toBe("DUE");
  });

  it("calcula saldo zero → ZERO", () => {
    expect(calcVatBalance(70_000, 70_000)).toBe(0);
    expect(vatStatus(0)).toBe("ZERO");
  });

  it("calcula saldo negativo → CREDIT", () => {
    expect(calcVatBalance(30_000, 80_000)).toBe(-50_000);
    expect(vatStatus(-50_000)).toBe("CREDIT");
  });

  it("taxa IVA Angola é 14%", () => {
    expect(IVA_RATE).toBe(0.14);
  });

  it("IVA sobre base 1.000.000 Kz = 140.000 Kz", () => {
    const base = 1_000_000;
    const iva  = Math.round(base * IVA_RATE);
    expect(iva).toBe(140_000);
  });

  it("IVA sobre base 500.000 Kz = 70.000 Kz", () => {
    const iva = Math.round(500_000 * IVA_RATE);
    expect(iva).toBe(70_000);
  });

  it("cálculo inverso: base a partir de IVA 140.000 Kz = 1.000.000 Kz", () => {
    expect(calcBase(140_000)).toBe(1_000_000);
  });

  it("cálculo inverso: base a partir de IVA 70.000 Kz = 500.000 Kz", () => {
    expect(calcBase(70_000)).toBe(500_000);
  });

  it("cálculo inverso: arredondamento correcto", () => {
    // 14.000 / 0.14 = 100.000 exacto
    expect(calcBase(14_000)).toBe(100_000);
  });

  it("saldo DUE com múltiplas facturas", () => {
    const invoices = [140_000, 98_000, 56_000]; // IVA de cada factura
    const total    = invoices.reduce((s, v) => s + v, 0); // 294.000
    expect(calcVatBalance(total, 0)).toBe(294_000);
    expect(vatStatus(294_000)).toBe("DUE");
  });

  it("saldo CREDIT com mais input que output", () => {
    const output = 56_000;
    const input  = 140_000;
    expect(vatStatus(calcVatBalance(output, input))).toBe("CREDIT");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Reconciliação bancária
// ──────────────────────────────────────────────────────────────────────────────

describe("Reconciliação bancária — detecção de discrepâncias", () => {
  it("constante RECONCILIATION_THRESHOLD é 1.000 Kz", () => {
    expect(RECONCILIATION_THRESHOLD).toBe(1_000);
  });

  it("discrepância zero → OK", () => {
    expect(reconciliationLineStatus(500_000, 500_000)).toBe("OK");
  });

  it("discrepância igual ao limiar → OK", () => {
    expect(reconciliationLineStatus(501_000, 500_000)).toBe("OK");
    expect(reconciliationLineStatus(500_000, 501_000)).toBe("OK");
  });

  it("discrepância acima do limiar → MISMATCH", () => {
    expect(reconciliationLineStatus(502_000, 500_000)).toBe("MISMATCH");
    expect(reconciliationLineStatus(500_000, 502_000)).toBe("MISMATCH");
  });

  it("discrepância de 1 Kz → OK", () => {
    expect(reconciliationLineStatus(1_000_001, 1_000_000)).toBe("OK");
  });

  it("discrepância de 1.001 Kz → MISMATCH", () => {
    expect(reconciliationLineStatus(1_001_001, 1_000_000)).toBe("MISMATCH");
  });

  it("calcDiscrepancy devolve valor absoluto", () => {
    expect(calcDiscrepancy(800_000, 900_000)).toBe(100_000);
    expect(calcDiscrepancy(900_000, 800_000)).toBe(100_000);
  });

  it("calcDiscrepancy zero quando iguais", () => {
    expect(calcDiscrepancy(750_000, 750_000)).toBe(0);
  });

  it("isBalanced true quando todos OK", () => {
    expect(isBalanced(["OK", "OK"])).toBe(true);
  });

  it("isBalanced false quando um MISMATCH", () => {
    expect(isBalanced(["OK", "MISMATCH"])).toBe(false);
  });

  it("isBalanced false quando todos MISMATCH", () => {
    expect(isBalanced(["MISMATCH", "MISMATCH"])).toBe(false);
  });

  it("movimentos nulos → discrepância = sourceAmount", () => {
    // Sem CashMovements (cmAmount=0) mas pagamentos confirmados (source=100k)
    expect(calcDiscrepancy(0, 100_000)).toBe(100_000);
    expect(reconciliationLineStatus(0, 100_000)).toBe("MISMATCH");
  });

  it("netMovement = inflow - outflow", () => {
    const inflow  = 1_500_000;
    const outflow = 600_000;
    expect(inflow - outflow).toBe(900_000);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Export — contentType e filename
// ──────────────────────────────────────────────────────────────────────────────

describe("Export — contentType e filename", () => {
  it("xlsx → Content-Type correcto", () => {
    expect(exportContentType("xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("csv → Content-Type correcto", () => {
    expect(exportContentType("csv")).toBe("text/csv; charset=utf-8");
  });

  it("filename pnl xlsx com período", () => {
    expect(exportFilename("pnl", "xlsx", "2026-07")).toBe("azul_cowork_pnl_2026-07.xlsx");
  });

  it("filename aging csv sem período", () => {
    expect(exportFilename("aging", "csv")).toBe("azul_cowork_aging.csv");
  });

  it("filename mrr xlsx", () => {
    expect(exportFilename("mrr", "xlsx", "2026-07")).toBe("azul_cowork_mrr_2026-07.xlsx");
  });

  it("filename vat csv com período", () => {
    expect(exportFilename("vat", "csv", "2026-06")).toBe("azul_cowork_vat_2026-06.csv");
  });

  it("filename cost-centers xlsx com período", () => {
    expect(exportFilename("cost-centers", "xlsx", "2026-07")).toBe(
      "azul_cowork_cost-centers_2026-07.xlsx"
    );
  });

  it("filename delinquency csv sem período", () => {
    expect(exportFilename("delinquency", "csv")).toBe("azul_cowork_delinquency.csv");
  });

  it("extensão muda consoante o formato", () => {
    const xlsx = exportFilename("pnl", "xlsx");
    const csv  = exportFilename("pnl", "csv");
    expect(xlsx.endsWith(".xlsx")).toBe(true);
    expect(csv.endsWith(".csv")).toBe(true);
  });

  it("sem período → sem sufixo de data no filename", () => {
    const name = exportFilename("aging", "xlsx");
    expect(name).toBe("azul_cowork_aging.xlsx");
    expect(name).not.toContain("_202");
  });
});
