/**
 * erp-dashboard-service.ts — Dashboard e Relatórios ERP (Volume 02 — Sprint ERP-7)
 *
 * Operações:
 *  getDashboardKpis        — R-01: KPIs em tempo real (MRR, ARR, receita, caixa, inadimplência…)
 *  getPnl                  — R-02: Demonstração de Resultados (P&L) por período
 *  getTrialBalance         — R-03: Balancete por conta PGC Angola
 *  getMrrBreakdown         — R-07: MRR breakdown (novo, expansão, contracção, churn, líquido)
 *  getDelinquencyReport    — R-08: Relatório de inadimplência
 *  getCostCenterReport     — R-09: Despesas real vs. orçado por centro de custo
 *  getContractsSummary     — R-10: Resumo de contratos por estado + a expirar
 *  generateMonthlySnapshot — cron fim de mês: gera FinancialReportSnapshot
 *
 * Docs: docs/05-erp/reports.md · docs/05-erp/cashflow.md
 */

import { prisma }             from "@/lib/prisma";
import {
  ContractStatus,
  ErpInvoiceStatus,
  ErpExpenseStatus,
  ErpPaymentStatus,
  LedgerType,
} from "@prisma/client";
import {
  startOfMonth, endOfMonth, subMonths, format,
  differenceInDays, addDays,
} from "date-fns";

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface DashboardKpis {
  // Receita
  mrr:                number;   // Monthly Recurring Revenue — contratos ACTIVE
  arr:                number;   // mrr × 12
  revenueCurrentMonth: number;  // faturado no mês (ErpInvoice ISSUED/SENT/PAID/OVERDUE/PARTIALLY_PAID)
  receivedCurrentMonth: number; // pagamentos CONFIRMED no mês
  // Inadimplência
  totalOutstanding:   number;   // valor em aberto (todas as faturas abertas)
  overdueAmount:      number;   // valor em aberto com dueDate passada
  delinquencyRate:    number;   // overdueAmount / revenueCurrentMonth (%)
  // Contratos
  activeContracts:    number;
  totalClients:       number;   // empresas com contrato ACTIVE
  churnedThisMonth:   number;   // contratos TERMINATED este mês
  churnRate:          number;   // % contratos perdidos no mês
  averageTicket:      number;   // mrr / activeContracts
  // Despesas e lucro
  expensesCurrentMonth: number; // despesas PAID no mês
  operatingProfit:    number;   // revenueCurrentMonth - expensesCurrentMonth
  // Caixa
  currentBalance:     number;   // último CashMovement.balance
  projectedBalance90: number;   // projecção 90 dias (simplificada: saldo + entradas esperadas - saídas esperadas)
  // Alertas
  activeAlerts:       number;   // FinancialAlert ACTIVE | ACKNOWLEDGED
  criticalAlerts:     number;
}

export interface PnlLine {
  accountCode: string;
  description: string;
  amount:      number;  // AOA — sempre positivo; sinal dado pela secção (proveito ou custo)
}

export interface PnlSection {
  title:   string;
  lines:   PnlLine[];
  total:   number;
}

export interface PnlReport {
  period:         string;     // "2026-07"
  revenue:        PnlSection;
  operationalCosts: PnlSection;
  grossMargin:    number;
  grossMarginPct: number;
  personnelCosts: PnlSection;
  generalExpenses: PnlSection;
  ebit:           number;     // Lucro operacional
  financialResult: number;
  profitBeforeTax: number;
}

export interface MrrPeriod {
  period:     string;   // "2026-07"
  newMrr:     number;   // contratos novos activados neste mês
  expansionMrr: number; // upgrades (não implementado no MVP — sempre 0)
  contractionMrr: number;
  churnMrr:   number;   // contratos terminados neste mês
  netMrr:     number;   // MRR líquido = anterior + new - churn - contraction + expansion
  totalMrr:   number;   // MRR total no fim do mês
}

export interface ContractsSummary {
  byStatus:   { status: string; count: number; totalMonthlyValue: number }[];
  expiringSoon: {
    contractId:   string;
    companyName:  string;
    endDate:      Date;
    daysLeft:     number;
    monthlyValue: number;
  }[];
  totalMrr:   number;
  totalActive: number;
}

export interface DelinquencyReport {
  totalOutstanding:    number;
  totalActive:         number;   // empresas com contrato ACTIVE
  delinquentCompanies: number;
  delinquencyRate:     number;   // %
  averageOutstanding:  number;
  oldestDebt:          number;   // dias do mais antigo em atraso
  lines: {
    companyId:    string;
    companyName:  string;
    outstanding:  number;
    oldestDays:   number;
    invoiceCount: number;
  }[];
}

export interface CostCenterReport {
  period: string;
  centers: {
    code:       string;
    name:       string;
    budget:     number | null;
    actual:     number;
    variance:   number;      // actual - budget
    variancePct: number | null; // % deviation
    status:     "OK" | "WARNING" | "CRITICAL" | "NO_BUDGET";
  }[];
}

// ── getDashboardKpis ───────────────────────────────────────────────────────────

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const now        = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);

  const [
    activeContracts,
    terminatedThisMonth,
    revenueAgg,
    receivedAgg,
    openInvoices,
    overdueInvoices,
    expensesAgg,
    lastBalance,
    alertCounts,
  ] = await prisma.$transaction([
    // MRR + activeContracts
    prisma.erpContract.aggregate({
      where: { status: ContractStatus.ACTIVE },
      _sum:  { monthlyValue: true },
      _count: true,
    }),
    // Churn do mês
    prisma.erpContract.count({
      where: {
        status:      ContractStatus.TERMINATED,
        terminatedAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    // Receita faturada no mês (subtotal de faturas emitidas)
    prisma.erpInvoice.aggregate({
      where: {
        status:    { in: [ErpInvoiceStatus.ISSUED, ErpInvoiceStatus.SENT,
                          ErpInvoiceStatus.PAID, ErpInvoiceStatus.OVERDUE,
                          ErpInvoiceStatus.PARTIALLY_PAID] },
        issueDate: { gte: monthStart, lte: monthEnd },
      },
      _sum: { total: true },
    }),
    // Recebido no mês (pagamentos confirmados)
    prisma.erpPayment.aggregate({
      where: {
        status:    ErpPaymentStatus.CONFIRMED,
        confirmedAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),
    // Faturas abertas (total outstanding)
    prisma.erpInvoice.findMany({
      where: { status: { in: [ErpInvoiceStatus.ISSUED, ErpInvoiceStatus.SENT,
                               ErpInvoiceStatus.OVERDUE, ErpInvoiceStatus.PARTIALLY_PAID] } },
      include: { erpPayments: { where: { status: "CONFIRMED" }, select: { amount: true } } },
    }),
    // Faturas em atraso
    prisma.erpInvoice.findMany({
      where: {
        status:  { in: [ErpInvoiceStatus.OVERDUE, ErpInvoiceStatus.ISSUED,
                        ErpInvoiceStatus.SENT, ErpInvoiceStatus.PARTIALLY_PAID] },
        dueDate: { lt: now },
      },
      include: { erpPayments: { where: { status: "CONFIRMED" }, select: { amount: true } } },
    }),
    // Despesas pagas no mês
    prisma.erpExpense.aggregate({
      where: {
        status:   ErpExpenseStatus.PAID,
        paidAt:   { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    // Saldo de caixa actual
    prisma.cashMovement.findFirst({
      where:   { bankAccount: "BCS-MAIN", isProjected: false },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select:  { balance: true },
    }),
    // Contagem de alertas
    prisma.financialAlert.groupBy({
      by:    ["severity"],
      where: { status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
      _count: true,
    }),
  ]);

  const mrr            = Math.round(activeContracts._sum.monthlyValue ?? 0);
  const arr            = mrr * 12;
  const active         = activeContracts._count;
  const averageTicket  = active > 0 ? Math.round(mrr / active) : 0;
  const churnRate      = active > 0 ? Math.round((terminatedThisMonth / active) * 100) : 0;

  const revenue        = Math.round(revenueAgg._sum.total ?? 0);
  const received       = Math.round(receivedAgg._sum.amount ?? 0);
  const expenses       = Math.round(expensesAgg._sum.amount ?? 0);
  const operatingProfit= revenue - expenses;

  const totalOutstanding = Math.round(
    openInvoices.reduce((s, inv) => {
      const paid = inv.erpPayments.reduce((p, pay) => p + pay.amount, 0);
      return s + Math.max(0, inv.total - paid);
    }, 0)
  );

  const overdueAmount = Math.round(
    overdueInvoices.reduce((s, inv) => {
      const paid = inv.erpPayments.reduce((p, pay) => p + pay.amount, 0);
      return s + Math.max(0, inv.total - paid);
    }, 0)
  );

  const delinquencyRate = revenue > 0
    ? Math.round((overdueAmount / revenue) * 100)
    : 0;

  const currentBalance    = Math.round(lastBalance?.balance ?? 0);
  // Projecção simplificada: saldo actual + MRR esperado (30 dias × 3 meses) - despesas fixas estimadas
  const projectedBalance90 = currentBalance + mrr * 3 - expenses * 3;

  const activeAlerts   = alertCounts.reduce((s, g) => s + g._count, 0);
  const criticalAlerts = alertCounts.find(g => g.severity === "CRITICAL")?._count ?? 0;

  return {
    mrr, arr,
    revenueCurrentMonth:  revenue,
    receivedCurrentMonth: received,
    totalOutstanding,
    overdueAmount,
    delinquencyRate,
    activeContracts:      active,
    totalClients:         active, // simplificação: 1 contrato ACTIVE por empresa
    churnedThisMonth:     terminatedThisMonth,
    churnRate,
    averageTicket,
    expensesCurrentMonth: expenses,
    operatingProfit,
    currentBalance,
    projectedBalance90,
    activeAlerts,
    criticalAlerts,
  };
}

// ── getPnl ─────────────────────────────────────────────────────────────────────

/**
 * Demonstração de Resultados (P&L) para um período.
 * Baseia-se no FinancialLedger (partida dupla) agrupado por conta PGC Angola.
 *
 * @param period — "YYYY-MM" (default: mês corrente)
 */
export async function getPnl(period?: string): Promise<PnlReport> {
  const target  = period ? new Date(`${period}-01`) : startOfMonth(new Date());
  const from    = startOfMonth(target);
  const to      = endOfMonth(target);
  const periodKey = format(from, "yyyy-MM");

  // Agregar Ledger por accountCode
  const ledger = await prisma.financialLedger.groupBy({
    by:    ["accountCode", "type"],
    where: { entryDate: { gte: from, lte: to } },
    _sum:  { amount: true },
  });

  // Helper: soma por prefixo de conta e tipo
  function sumByPrefix(prefix: string, type: LedgerType) {
    return Math.round(
      ledger
        .filter(e => e.accountCode.startsWith(prefix) && e.type === type)
        .reduce((s, e) => s + (e._sum.amount ?? 0), 0)
    );
  }

  // ── PROVEITOS (classe 7 — CREDIT é proveito) ────────────────────────
  const revenue: PnlSection = {
    title: "PROVEITOS",
    lines: [
      { accountCode: "711", description: "Mensalidades Coworking",    amount: sumByPrefix("711", LedgerType.CREDIT) },
      { accountCode: "712", description: "Salas de Reunião",          amount: sumByPrefix("712", LedgerType.CREDIT) },
      { accountCode: "713", description: "Serviços Adicionais",       amount: sumByPrefix("713", LedgerType.CREDIT) },
      { accountCode: "71",  description: "Outros Proveitos",          amount: sumByPrefix("71",  LedgerType.CREDIT)
          - sumByPrefix("711", LedgerType.CREDIT)
          - sumByPrefix("712", LedgerType.CREDIT)
          - sumByPrefix("713", LedgerType.CREDIT) },
    ].filter(l => l.amount > 0),
    total: 0,
  };
  revenue.total = Math.round(revenue.lines.reduce((s, l) => s + l.amount, 0));

  // ── CUSTOS OPERACIONAIS (611x-612x — DEBIT) ─────────────────────────
  const operationalCosts: PnlSection = {
    title: "CUSTOS OPERACIONAIS",
    lines: [
      { accountCode: "6111", description: "Renda do Imóvel",    amount: sumByPrefix("6111", LedgerType.DEBIT) },
      { accountCode: "6121", description: "Electricidade",      amount: sumByPrefix("6121", LedgerType.DEBIT) },
      { accountCode: "6122", description: "Água",               amount: sumByPrefix("6122", LedgerType.DEBIT) },
      { accountCode: "6123", description: "Internet / Telecom", amount: sumByPrefix("6123", LedgerType.DEBIT) },
      { accountCode: "6124", description: "Limpeza e Higiene",  amount: sumByPrefix("6124", LedgerType.DEBIT) },
      { accountCode: "6125", description: "Segurança",          amount: sumByPrefix("6125", LedgerType.DEBIT) },
      { accountCode: "6611", description: "Manutenção",         amount: sumByPrefix("6611", LedgerType.DEBIT) },
    ].filter(l => l.amount > 0),
    total: 0,
  };
  operationalCosts.total = Math.round(operationalCosts.lines.reduce((s, l) => s + l.amount, 0));

  const grossMargin    = revenue.total - operationalCosts.total;
  const grossMarginPct = revenue.total > 0
    ? Math.round((grossMargin / revenue.total) * 100)
    : 0;

  // ── CUSTOS COM PESSOAL (621x) ────────────────────────────────────────
  const personnelCosts: PnlSection = {
    title: "CUSTOS COM PESSOAL",
    lines: [
      { accountCode: "6211", description: "Salários",             amount: sumByPrefix("6211", LedgerType.DEBIT) },
      { accountCode: "6212", description: "Encargos Sociais (INSS)", amount: sumByPrefix("6212", LedgerType.DEBIT) },
      { accountCode: "6213", description: "Subsídios / Benefícios",  amount: sumByPrefix("6213", LedgerType.DEBIT) },
    ].filter(l => l.amount > 0),
    total: 0,
  };
  personnelCosts.total = Math.round(personnelCosts.lines.reduce((s, l) => s + l.amount, 0));

  // ── DESPESAS GERAIS (631x + 641x + 651x) ────────────────────────────
  const generalExpenses: PnlSection = {
    title: "DESPESAS GERAIS",
    lines: [
      { accountCode: "6311", description: "Marketing Digital",      amount: sumByPrefix("6311", LedgerType.DEBIT) },
      { accountCode: "6312", description: "Publicidade",             amount: sumByPrefix("6312", LedgerType.DEBIT) },
      { accountCode: "6411", description: "Servidores / Cloud",     amount: sumByPrefix("6411", LedgerType.DEBIT) },
      { accountCode: "6412", description: "Domínios e Certificados",amount: sumByPrefix("6412", LedgerType.DEBIT) },
      { accountCode: "6413", description: "Licenças de Software",   amount: sumByPrefix("6413", LedgerType.DEBIT) },
      { accountCode: "6511", description: "Material de Escritório", amount: sumByPrefix("6511", LedgerType.DEBIT) },
      { accountCode: "6512", description: "Seguros",                amount: sumByPrefix("6512", LedgerType.DEBIT) },
      { accountCode: "6513", description: "Serviços Jurídicos",     amount: sumByPrefix("6513", LedgerType.DEBIT) },
    ].filter(l => l.amount > 0),
    total: 0,
  };
  generalExpenses.total = Math.round(generalExpenses.lines.reduce((s, l) => s + l.amount, 0));

  const ebit = grossMargin - personnelCosts.total - generalExpenses.total;

  // Resultado financeiro: proveitos financeiros (conta 79x) - encargos financeiros (conta 69x)
  const financialIncome = sumByPrefix("79", LedgerType.CREDIT);
  const financialCharges= sumByPrefix("69", LedgerType.DEBIT);
  const financialResult = financialIncome - financialCharges;

  return {
    period: periodKey,
    revenue,
    operationalCosts,
    grossMargin,
    grossMarginPct,
    personnelCosts,
    generalExpenses,
    ebit,
    financialResult,
    profitBeforeTax: ebit + financialResult,
  };
}

// ── getTrialBalance ────────────────────────────────────────────────────────────

/**
 * Balancete (R-03): saldo devedor e credor por conta PGC Angola no período.
 * @param period — "YYYY-MM" (default: mês corrente)
 */
export async function getTrialBalance(period?: string) {
  const target  = period ? new Date(`${period}-01`) : startOfMonth(new Date());
  const from    = startOfMonth(target);
  const to      = endOfMonth(target);

  const ledger = await prisma.financialLedger.groupBy({
    by:    ["accountCode", "type"],
    where: { entryDate: { gte: from, lte: to } },
    _sum:  { amount: true },
    orderBy: { accountCode: "asc" },
  });

  // Organizar por accountCode
  const accounts = new Map<string, { debit: number; credit: number }>();
  for (const entry of ledger) {
    if (!accounts.has(entry.accountCode))
      accounts.set(entry.accountCode, { debit: 0, credit: 0 });
    const acc = accounts.get(entry.accountCode)!;
    if (entry.type === LedgerType.DEBIT)  acc.debit  += entry._sum.amount ?? 0;
    if (entry.type === LedgerType.CREDIT) acc.credit += entry._sum.amount ?? 0;
  }

  const lines = [...accounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, { debit, credit }]) => ({
      accountCode: code,
      debit:       Math.round(debit),
      credit:      Math.round(credit),
      balance:     Math.round(debit - credit),
    }));

  const totalDebit  = Math.round(lines.reduce((s, l) => s + l.debit,  0));
  const totalCredit = Math.round(lines.reduce((s, l) => s + l.credit, 0));

  return {
    period: format(from, "yyyy-MM"),
    lines,
    totalDebit,
    totalCredit,
    balanced: totalDebit === totalCredit, // deve ser sempre true (partida dupla)
  };
}

// ── getMrrBreakdown ────────────────────────────────────────────────────────────

/**
 * MRR Breakdown para os últimos N meses (R-07).
 * new = contratos activados no mês
 * churn = contratos terminados no mês
 * netMrr = totalMrr_anterior + new - churn
 *
 * @param months — número de meses a analisar (default: 6)
 */
export async function getMrrBreakdown(months = 6): Promise<MrrPeriod[]> {
  const result: MrrPeriod[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const periodDate = subMonths(now, i);
    const from       = startOfMonth(periodDate);
    const to         = endOfMonth(periodDate);
    const periodKey  = format(from, "yyyy-MM");

    const [newContracts, terminatedContracts, totalActive] = await prisma.$transaction([
      // Novos contratos activados neste mês
      prisma.erpContract.findMany({
        where: { status: { not: ContractStatus.DRAFT }, createdAt: { gte: from, lte: to } },
        select: { monthlyValue: true },
      }),
      // Contratos terminados neste mês
      prisma.erpContract.findMany({
        where: { status: ContractStatus.TERMINATED, terminatedAt: { gte: from, lte: to } },
        select: { monthlyValue: true },
      }),
      // MRR total de contratos ACTIVE no fim do mês
      prisma.erpContract.aggregate({
        where: {
          status:    ContractStatus.ACTIVE,
          createdAt: { lte: to },
        },
        _sum: { monthlyValue: true },
      }),
    ]);

    const newMrr     = Math.round(newContracts.reduce((s, c) => s + c.monthlyValue, 0));
    const churnMrr   = Math.round(terminatedContracts.reduce((s, c) => s + c.monthlyValue, 0));
    const totalMrr   = Math.round(totalActive._sum.monthlyValue ?? 0);
    const prevTotal  = result.length > 0 ? result[result.length - 1].totalMrr : 0;
    const netMrr     = newMrr - churnMrr;

    result.push({
      period:         periodKey,
      newMrr,
      expansionMrr:   0,  // não implementado no MVP
      contractionMrr: 0,  // não implementado no MVP
      churnMrr,
      netMrr,
      totalMrr,
    });
  }

  return result;
}

// ── getDelinquencyReport ───────────────────────────────────────────────────────

export async function getDelinquencyReport(): Promise<DelinquencyReport> {
  const now = new Date();

  const [openInvoices, totalActive] = await prisma.$transaction([
    prisma.erpInvoice.findMany({
      where: {
        status:  { in: [ErpInvoiceStatus.OVERDUE, ErpInvoiceStatus.ISSUED,
                        ErpInvoiceStatus.SENT, ErpInvoiceStatus.PARTIALLY_PAID] },
        dueDate: { lt: now },
        companyId: { not: null },
      },
      include: {
        company:     { select: { id: true, name: true } },
        erpPayments: { where: { status: "CONFIRMED" }, select: { amount: true } },
      },
    }),
    prisma.erpContract.count({ where: { status: ContractStatus.ACTIVE } }),
  ]);

  // Agregar por empresa
  const companyMap = new Map<string, {
    companyId:    string;
    companyName:  string;
    outstanding:  number;
    oldestDays:   number;
    invoiceCount: number;
  }>();

  for (const inv of openInvoices) {
    if (!inv.companyId) continue;
    const paid  = inv.erpPayments.reduce((s, p) => s + p.amount, 0);
    const owed  = Math.max(0, Math.round(inv.total - paid));
    if (owed === 0) continue;

    const days = differenceInDays(now, inv.dueDate);

    if (!companyMap.has(inv.companyId)) {
      companyMap.set(inv.companyId, {
        companyId:   inv.companyId,
        companyName: inv.company?.name ?? "",
        outstanding: 0,
        oldestDays:  0,
        invoiceCount: 0,
      });
    }
    const entry = companyMap.get(inv.companyId)!;
    entry.outstanding  += owed;
    entry.oldestDays    = Math.max(entry.oldestDays, days);
    entry.invoiceCount += 1;
  }

  const lines = [...companyMap.values()]
    .sort((a, b) => b.outstanding - a.outstanding);

  const totalOutstanding     = Math.round(lines.reduce((s, l) => s + l.outstanding, 0));
  const delinquentCompanies  = lines.length;
  const delinquencyRate      = totalActive > 0
    ? Math.round((delinquentCompanies / totalActive) * 100)
    : 0;
  const averageOutstanding   = delinquentCompanies > 0
    ? Math.round(totalOutstanding / delinquentCompanies)
    : 0;
  const oldestDebt           = lines.reduce((m, l) => Math.max(m, l.oldestDays), 0);

  return {
    totalOutstanding,
    totalActive,
    delinquentCompanies,
    delinquencyRate,
    averageOutstanding,
    oldestDebt,
    lines,
  };
}

// ── getCostCenterReport ────────────────────────────────────────────────────────

export async function getCostCenterReport(period?: string): Promise<CostCenterReport> {
  const target  = period ? new Date(`${period}-01`) : startOfMonth(new Date());
  const from    = startOfMonth(target);
  const to      = endOfMonth(target);
  const periodKey = format(from, "yyyy-MM");

  const costCenters = await prisma.costCenter.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  const centers = await Promise.all(costCenters.map(async (cc) => {
    const agg = await prisma.erpExpense.aggregate({
      where: {
        costCenterId: cc.id,
        status:       ErpExpenseStatus.PAID,
        paidAt:       { gte: from, lte: to },
        deletedAt:    null,
      },
      _sum: { amount: true },
    });

    const actual   = Math.round(agg._sum.amount ?? 0);
    const budget   = cc.budget ? Math.round(cc.budget) : null;
    const variance = budget !== null ? actual - budget : 0;
    const variancePct = budget && budget > 0
      ? Math.round(((actual / budget) - 1) * 100)
      : null;

    let status: "OK" | "WARNING" | "CRITICAL" | "NO_BUDGET" = "NO_BUDGET";
    if (budget !== null && budget > 0) {
      const ratio = actual / budget;
      if      (ratio >= 1.30) status = "CRITICAL";
      else if (ratio >= 1.15) status = "WARNING";
      else                    status = "OK";
    }

    return { code: cc.code, name: cc.name, budget, actual, variance, variancePct, status };
  }));

  return { period: periodKey, centers };
}

// ── getContractsSummary ────────────────────────────────────────────────────────

export async function getContractsSummary(): Promise<ContractsSummary> {
  const today    = new Date();
  const in90days = addDays(today, 90);

  const [byStatus, expiring, mrrAgg] = await prisma.$transaction([
    prisma.erpContract.groupBy({
      by:    ["status"],
      _count: true,
      _sum:  { monthlyValue: true },
    }),
    prisma.erpContract.findMany({
      where: {
        status:  ContractStatus.ACTIVE,
        endDate: { not: null, gte: today, lte: in90days },
      },
      include: { company: { select: { name: true } } },
      orderBy: { endDate: "asc" },
    }),
    prisma.erpContract.aggregate({
      where: { status: ContractStatus.ACTIVE },
      _sum:  { monthlyValue: true },
    }),
  ]);

  return {
    byStatus: byStatus.map(s => ({
      status:            s.status,
      count:             s._count,
      totalMonthlyValue: Math.round(s._sum.monthlyValue ?? 0),
    })),
    expiringSoon: expiring.map(c => ({
      contractId:   c.id,
      companyName:  c.company?.name ?? "",
      endDate:      c.endDate!,
      daysLeft:     differenceInDays(c.endDate!, today),
      monthlyValue: Math.round(c.monthlyValue),
    })),
    totalMrr:    Math.round(mrrAgg._sum.monthlyValue ?? 0),
    totalActive: byStatus.find(s => s.status === ContractStatus.ACTIVE)?._count ?? 0,
  };
}

// ── generateMonthlySnapshot ────────────────────────────────────────────────────

/**
 * Gera FinancialReportSnapshot no fecho do mês.
 * Chamado pelo cron /api/cron/erp-monthly-snapshot no último dia do mês.
 * Idempotente: usa upsert por (period, type).
 */
export async function generateMonthlySnapshot(period?: string, actorId = "SYSTEM") {
  const target    = period ? new Date(`${period}-01`) : subMonths(new Date(), 1);
  const periodKey = format(startOfMonth(target), "yyyy-MM");

  const [kpis, pnl, mrrBreakdown, contracts] = await Promise.all([
    getDashboardKpis(),
    getPnl(periodKey),
    getMrrBreakdown(1),
    getContractsSummary(),
  ]);

  const data = {
    mrr:              kpis.mrr,
    arr:              kpis.arr,
    revenue:          kpis.revenueCurrentMonth,
    received:         kpis.receivedCurrentMonth,
    expenses:         kpis.expensesCurrentMonth,
    operatingProfit:  kpis.operatingProfit,
    ebit:             pnl.ebit,
    grossMarginPct:   pnl.grossMarginPct,
    totalOutstanding: kpis.totalOutstanding,
    overdueAmount:    kpis.overdueAmount,
    delinquencyRate:  kpis.delinquencyRate,
    activeContracts:  contracts.totalActive,
    churnRate:        kpis.churnRate,
    currentBalance:   kpis.currentBalance,
    mrrNet:           mrrBreakdown[0]?.netMrr ?? 0,
    generatedAt:      new Date().toISOString(),
  };

  return prisma.financialReportSnapshot.upsert({
    where:  { period_type: { period: periodKey, type: "MONTHLY" } },
    update: { data, generatedBy: actorId },
    create: { period: periodKey, type: "MONTHLY", data, generatedBy: actorId },
  });
}
