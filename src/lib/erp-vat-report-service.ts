/**
 * erp-vat-report-service.ts — Relatório de IVA mensal (Volume 02 — Sprint ERP-9)
 *
 * R-07: Apuramento mensal de IVA Angola (Lei n.º 17/19 — taxa 14%)
 *
 * Contas PGC Angola:
 *   2311 — IVA a pagar (liquidado): CREDIT entries = IVA cobrado aos clientes
 *   2312 — IVA dedutível:           DEBIT entries  = IVA pago a fornecedores com NIF
 *
 * Apuramento = IVA Liquidado − IVA Dedutível
 *   Se positivo → empresa deve ao Estado
 *   Se negativo → Estado deve à empresa (crédito)
 *
 * Docs: docs/05-erp/reports.md#r-07
 */

import { prisma }       from "@/lib/prisma";
import { LedgerType }   from "@prisma/client";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";

const ACCOUNT_IVA_OUTPUT = "2311"; // IVA a pagar
const ACCOUNT_IVA_INPUT  = "2312"; // IVA dedutível
export const IVA_RATE    = 0.14;   // Lei n.º 17/19 Angola

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface VatLine {
  invoiceId?:    string;
  invoiceNumber?: string;
  expenseId?:    string;
  description:   string;
  date:          Date;
  baseAmount:    number;   // AOA sem IVA
  vatAmount:     number;   // AOA
  type:          "OUTPUT" | "INPUT"; // liquidado | dedutível
}

export interface VatReport {
  period:          string;           // "2026-07"
  // IVA Liquidado (clientes)
  outputVat:       number;           // total IVA cobrado (conta 2311 CREDIT)
  outputLines:     VatLine[];
  // IVA Dedutível (fornecedores)
  inputVat:        number;           // total IVA dedutível (conta 2312 DEBIT)
  inputLines:      VatLine[];
  // Apuramento
  vatBalance:      number;           // outputVat − inputVat (positivo → pagar ao Estado)
  status:          "DUE" | "CREDIT" | "ZERO"; // DUE = deve ao Estado, CREDIT = Estado deve
}

/** Histórico de IVA dos últimos N meses (para análise de tendência). */
export interface VatSummaryPeriod {
  period:     string;
  outputVat:  number;
  inputVat:   number;
  vatBalance: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePeriod(period?: string): { start: Date; end: Date; key: string } {
  if (period) {
    const [y, m] = period.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return { start: startOfMonth(d), end: endOfMonth(d), key: period };
  }
  const now = new Date();
  return {
    start: startOfMonth(now),
    end:   endOfMonth(now),
    key:   format(now, "yyyy-MM"),
  };
}

// ── getVatReport ──────────────────────────────────────────────────────────────

/**
 * Apuramento de IVA para um período mensal.
 * @param period "YYYY-MM" — omitir = mês corrente
 */
export async function getVatReport(period?: string): Promise<VatReport> {
  const { start, end, key } = parsePeriod(period);

  // Agrega IVA Liquidado (conta 2311, tipo CREDIT)
  const [outputEntries, inputEntries] = await prisma.$transaction([
    prisma.financialLedger.findMany({
      where: {
        accountCode: ACCOUNT_IVA_OUTPUT,
        type:        LedgerType.CREDIT,
        entryDate:   { gte: start, lte: end },
      },
      include: {
        invoice: { select: { id: true, number: true } },
      },
      orderBy: { entryDate: "asc" },
    }),
    prisma.financialLedger.findMany({
      where: {
        accountCode: ACCOUNT_IVA_INPUT,
        type:        LedgerType.DEBIT,
        entryDate:   { gte: start, lte: end },
      },
      include: {
        expense: { select: { id: true, description: true, supplierName: true } },
      },
      orderBy: { entryDate: "asc" },
    }),
  ]);

  const outputVat = outputEntries.reduce((s, e) => s + e.amount, 0);
  const inputVat  = inputEntries.reduce((s, e) => s + e.amount, 0);
  const vatBalance = Math.round(outputVat - inputVat);

  const outputLines: VatLine[] = outputEntries.map((e) => ({
    invoiceId:     e.invoice?.id,
    invoiceNumber: e.invoice?.number,
    description:   e.description,
    date:          e.entryDate,
    baseAmount:    Math.round(e.amount / IVA_RATE),  // dedução inversa
    vatAmount:     Math.round(e.amount),
    type:          "OUTPUT",
  }));

  const inputLines: VatLine[] = inputEntries.map((e) => ({
    expenseId:     e.expense?.id,
    description:   e.expense?.supplierName
      ? `${e.expense.supplierName} — ${e.expense.description}`
      : e.description,
    date:          e.entryDate,
    baseAmount:    Math.round(e.amount / IVA_RATE),
    vatAmount:     Math.round(e.amount),
    type:          "INPUT",
  }));

  const status: VatReport["status"] =
    vatBalance > 0 ? "DUE" : vatBalance < 0 ? "CREDIT" : "ZERO";

  return {
    period:      key,
    outputVat:   Math.round(outputVat),
    outputLines,
    inputVat:    Math.round(inputVat),
    inputLines,
    vatBalance,
    status,
  };
}

// ── getVatHistory ─────────────────────────────────────────────────────────────

/**
 * Resumo de IVA dos últimos N meses (para gráfico de tendência).
 * @param months número de meses a incluir (default: 6)
 */
export async function getVatHistory(months = 6): Promise<VatSummaryPeriod[]> {
  const now    = new Date();
  const result: VatSummaryPeriod[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d     = subMonths(now, i);
    const start = startOfMonth(d);
    const end   = endOfMonth(d);
    const key   = format(d, "yyyy-MM");

    const [outputAgg, inputAgg] = await prisma.$transaction([
      prisma.financialLedger.aggregate({
        where: {
          accountCode: ACCOUNT_IVA_OUTPUT,
          type:        LedgerType.CREDIT,
          entryDate:   { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.financialLedger.aggregate({
        where: {
          accountCode: ACCOUNT_IVA_INPUT,
          type:        LedgerType.DEBIT,
          entryDate:   { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
    ]);

    const outputVat  = Math.round(outputAgg._sum.amount ?? 0);
    const inputVat   = Math.round(inputAgg._sum.amount  ?? 0);

    result.push({
      period:     key,
      outputVat,
      inputVat,
      vatBalance: outputVat - inputVat,
    });
  }

  return result;
}
