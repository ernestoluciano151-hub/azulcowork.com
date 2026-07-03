/**
 * finance.ts — helpers de cálculo ERP
 * Todos os valores são Float (AOA) sem arredondamentos intermédios.
 */

import { differenceInCalendarMonths } from "date-fns";

// ── meses inclusivos entre duas datas ────────────────────────────────────────
export function calcContractMonths(start: Date, end: Date): number {
  return Math.max(1, differenceInCalendarMonths(end, start) + 1);
}

// ── valor total contratado ───────────────────────────────────────────────────
export function calcTotalContracted(rentAmount: number, start: Date, end: Date): number {
  return Math.round(rentAmount * calcContractMonths(start, end) * 100) / 100;
}

// ── estado financeiro automático ─────────────────────────────────────────────
export function calcFinancialStatus(
  totalContracted: number,
  totalPaid: number,
  dueDateOverdue = false
): "LIQUIDADO" | "PAGO_PARCIALMENTE" | "EM_ATRASO" | "PENDENTE" {
  if (totalPaid >= totalContracted) return "LIQUIDADO";
  if (totalPaid > 0)               return "PAGO_PARCIALMENTE";
  if (dueDateOverride(dueDateOverdue)) return "EM_ATRASO";
  return "PENDENTE";
}

function dueDateOverride(flag: boolean) { return flag; }

// ── formatar AOA ─────────────────────────────────────────────────────────────
export function fmtAOA(v: number): string {
  return new Intl.NumberFormat("pt-AO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v) + " AOA";
}

// ── sumário financeiro de uma empresa (usa Prisma) ──────────────────────────
import type { PrismaClient } from "@prisma/client";

export async function getCompanyFinanceSummary(
  prisma: PrismaClient,
  companyId: string
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      payments: { orderBy: { dueDate: "desc" } },
      invoices: { orderBy: { issueDate: "desc" }, take: 5 },
      financialHistory: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!company) return null;

  const months          = calcContractMonths(company.contractStart, company.contractEnd);
  const totalContracted = calcTotalContracted(company.rentAmount, company.contractStart, company.contractEnd);
  const totalPaid       = company.payments
    .filter((p) => p.status === "PAGO")
    .reduce((s, p) => s + p.amount, 0);
  const balance         = totalContracted - totalPaid;
  const now             = new Date();
  const isOverdue       = company.payments.some(
    (p) => p.status !== "PAGO" && new Date(p.dueDate) < now
  );
  const financialStatus = calcFinancialStatus(totalContracted, totalPaid, isOverdue);

  return {
    company,
    months,
    totalContracted,
    totalPaid,
    balance,
    financialStatus,
  };
}

// ── registar entrada no histórico ────────────────────────────────────────────
export async function recordFinancialHistory(
  prisma: PrismaClient,
  params: {
    companyId:   string;
    type:        string;
    description: string;
    amount:      number;
    method?:     string;
    reference?:  string;
    createdBy?:  string;
  }
) {
  // calcular runningBalance = totalPaid - totalContracted (negativo se em dívida)
  const company = await prisma.company.findUnique({ where: { id: params.companyId } });
  if (!company) return;

  const totalContracted = calcTotalContracted(
    company.rentAmount,
    company.contractStart,
    company.contractEnd
  );
  const paidAgg = await prisma.payment.aggregate({
    where: { companyId: params.companyId, status: "PAGO" },
    _sum: { amount: true },
  });
  const totalPaid       = paidAgg._sum.amount || 0;
  const runningBalance  = totalPaid - totalContracted; // negativo = em dívida

  await prisma.financialHistory.create({
    data: {
      companyId:      params.companyId,
      type:           params.type,
      description:    params.description,
      amount:         params.amount,
      runningBalance,
      method:         params.method  ?? null,
      reference:      params.reference ?? null,
      createdBy:      params.createdBy ?? null,
    },
  });
}
