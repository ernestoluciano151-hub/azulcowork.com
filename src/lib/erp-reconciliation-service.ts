/**
 * erp-reconciliation-service.ts — Reconciliação bancária (Volume 02 — Sprint ERP-9)
 *
 * R-05: Compara os movimentos de caixa registados (CashMovement)
 *       com os pagamentos e despesas confirmados no período.
 *
 * Lógica:
 *   INFLOW real   = soma CashMovements INFLOW não projectados no período
 *   INFLOW fonte  = soma ErpPayments CONFIRMED no período
 *   Discrepância  = |INFLOW real − INFLOW fonte|
 *
 *   OUTFLOW real  = soma CashMovements OUTFLOW não projectados no período
 *   OUTFLOW fonte = soma ErpExpenses PAID no período
 *   Discrepância  = |OUTFLOW real − OUTFLOW fonte|
 *
 * Uma discrepância > RECONCILIATION_THRESHOLD (Kz 1.000) é assinalada.
 *
 * Docs: docs/05-erp/reports.md#r-05
 */

import { prisma }            from "@/lib/prisma";
import { CashMovementType, ErpPaymentStatus, ErpExpenseStatus } from "@prisma/client";
import { startOfMonth, endOfMonth, format } from "date-fns";

/** Limiar de discrepância considerado relevante (Kz) */
export const RECONCILIATION_THRESHOLD = 1_000;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ReconciliationLine {
  label:       string;
  cmAmount:    number;   // total registado em CashMovement
  sourceAmount: number;  // total calculado a partir de Payments/Expenses
  discrepancy: number;   // |cmAmount - sourceAmount|
  status:      "OK" | "MISMATCH";
}

export interface ReconciliationReport {
  period:          string;          // "2026-07"
  bankAccount:     string;
  openingBalance:  number;          // saldo no início do período
  closingBalance:  number;          // saldo no fim do período
  totalInflow:     number;          // entradas reais (CashMovement INFLOW)
  totalOutflow:    number;          // saídas reais (CashMovement OUTFLOW)
  netMovement:     number;          // totalInflow − totalOutflow
  lines:           ReconciliationLine[];
  isBalanced:      boolean;         // true se todas as linhas OK
  discrepancyTotal: number;         // soma das discrepâncias
  movements: {                      // lista dos movimentos no período
    id:          string;
    date:        Date;
    type:        string;
    amount:      number;
    description: string;
    source:      string;
    balance:     number;
  }[];
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

// ── getReconciliationReport ───────────────────────────────────────────────────

export async function getReconciliationReport(
  period?:     string,
  bankAccount  = "BCS-MAIN"
): Promise<ReconciliationReport> {
  const { start, end, key } = parsePeriod(period);

  // 1. Movimentos reais no período (não projectados)
  const [
    cmMovements,
    confirmedPayments,
    paidExpenses,
    prevBalance,
  ] = await prisma.$transaction([
    // Todos os movimentos reais no período
    prisma.cashMovement.findMany({
      where: {
        date:        { gte: start, lte: end },
        isProjected: false,
        bankAccount: { equals: bankAccount },
      },
      orderBy: { date: "asc" },
    }),
    // Pagamentos confirmados no período (fonte dos INFLOWs)
    prisma.erpPayment.aggregate({
      where: {
        status:      ErpPaymentStatus.CONFIRMED,
        confirmedAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    // Despesas pagas no período (fonte dos OUTFLOWs)
    prisma.erpExpense.aggregate({
      where: {
        status: ErpExpenseStatus.PAID,
        paidAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    // Último saldo antes do período (saldo de abertura)
    prisma.cashMovement.findFirst({
      where: {
        date:        { lt: start },
        isProjected: false,
        bankAccount: { equals: bankAccount },
      },
      orderBy: { date: "desc" },
      select:  { balance: true },
    }),
  ]);

  // 2. Calcular totais dos movimentos reais
  const realInflow  = cmMovements
    .filter((m) => m.type === CashMovementType.INFLOW)
    .reduce((s, m) => s + m.amount, 0);
  const realOutflow = cmMovements
    .filter((m) => m.type === CashMovementType.OUTFLOW)
    .reduce((s, m) => s + m.amount, 0);

  const sourceInflow  = confirmedPayments._sum.amount ?? 0;
  const sourceOutflow = paidExpenses._sum.amount      ?? 0;

  // 3. Linhas de reconciliação
  const inflowLine: ReconciliationLine = {
    label:        "Entradas (pagamentos recebidos)",
    cmAmount:     Math.round(realInflow),
    sourceAmount: Math.round(sourceInflow),
    discrepancy:  Math.abs(Math.round(realInflow) - Math.round(sourceInflow)),
    status:
      Math.abs(realInflow - sourceInflow) <= RECONCILIATION_THRESHOLD ? "OK" : "MISMATCH",
  };

  const outflowLine: ReconciliationLine = {
    label:        "Saídas (despesas pagas)",
    cmAmount:     Math.round(realOutflow),
    sourceAmount: Math.round(sourceOutflow),
    discrepancy:  Math.abs(Math.round(realOutflow) - Math.round(sourceOutflow)),
    status:
      Math.abs(realOutflow - sourceOutflow) <= RECONCILIATION_THRESHOLD ? "OK" : "MISMATCH",
  };

  const lines = [inflowLine, outflowLine];
  const discrepancyTotal = lines.reduce((s, l) => s + l.discrepancy, 0);

  // 4. Saldos
  const openingBalance = prevBalance?.balance ?? 0;
  const closingBalance = cmMovements.length > 0
    ? cmMovements[cmMovements.length - 1].balance
    : openingBalance;

  return {
    period:          key,
    bankAccount,
    openingBalance:  Math.round(openingBalance),
    closingBalance:  Math.round(closingBalance),
    totalInflow:     Math.round(realInflow),
    totalOutflow:    Math.round(realOutflow),
    netMovement:     Math.round(realInflow - realOutflow),
    lines,
    isBalanced:      lines.every((l) => l.status === "OK"),
    discrepancyTotal: Math.round(discrepancyTotal),
    movements: cmMovements.map((m) => ({
      id:          m.id,
      date:        m.date,
      type:        m.type,
      amount:      Math.round(m.amount),
      description: m.description,
      source:      m.source,
      balance:     Math.round(m.balance),
    })),
  };
}
