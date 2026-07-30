/**
 * erp-cashflow-service.ts — Fluxo de Caixa ERP (Volume 02 — Sprint ERP-5)
 *
 * Operações:
 *  recalculateBalances  — recalcula CashMovement.balance em sequência cronológica
 *                         chamado após confirmação de pagamento ou pagamento de despesa
 *  getCashflowMovements — listagem de movimentos reais (+ projectados opcionais)
 *                         agrupados por dia / semana / mês
 *  getCashflowProjection — projecção 30 / 60 / 90 dias
 *                          combina movimentos reais + RentSchedules PENDING + Expenses recorrentes
 *  getCashflowKpis      — KPIs de tesouraria: saldo actual, MRR, burn rate, runway
 *  registerAdjustment   — regista ajuste manual (reconciliação bancária)
 *  detectNegativeBalance — cria FinancialAlert se saldo projectado < 0 nos próximos 30d
 *
 * Regras:
 *  - ADR-025: CashMovement populado por event handlers, nunca directamente na fatura/despesa
 *  - balance é recalculado em ordem cronológica (date ASC, createdAt ASC)
 *  - OUTFLOW subtrai; INFLOW e TRANSFER somam ao saldo
 *  - Projecção usa isProjected=true; real usa isProjected=false
 *  - Toda operação de escrita usa prisma.$transaction()
 *
 * Docs: docs/05-erp/cashflow.md · docs/adr/README.md#adr-025
 */

import { prisma }                 from "@/lib/prisma";
import { publish }                from "@/lib/event-bus";
import {
  CashMovementType,
  CashMovementSource,
  AlertType,
  AlertSeverity,
  AlertStatus,
  ErpInvoiceStatus,
  ErpExpenseStatus,
  ExpenseRecurrence,
} from "@prisma/client";
import { addDays, startOfDay, endOfDay, startOfWeek, startOfMonth,
         format, addMonths, differenceInDays }  from "date-fns";
import { nanoid }                 from "nanoid";

// ── Constantes ────────────────────────────────────────────────────────────────

const BANK_ACCOUNT    = "BCS-MAIN";
const NEGATIVE_ALERT_THRESHOLD = 0; // Kz — abaixo deste valor → alerta

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type GroupBy = "day" | "week" | "month";

export interface CashflowPeriodEntry {
  periodKey:   string;   // "2026-08-01" | "2026-W32" | "2026-08"
  periodLabel: string;   // "1 Ago 2026" | "Semana 32" | "Agosto 2026"
  inflow:      number;
  outflow:     number;
  net:         number;   // inflow - outflow
  closingBalance: number; // saldo no fim do período
}

export interface CashflowProjectionEntry {
  date:        Date;
  type:        CashMovementType;
  amount:      number;
  description: string;
  isProjected: boolean;
  runningBalance: number;
}

export interface CashflowKpis {
  currentBalance:     number;   // saldo mais recente
  projectedBalance30: number;   // saldo projectado em 30 dias
  projectedBalance90: number;   // saldo projectado em 90 dias
  inflowCurrentMonth: number;   // entradas reais no mês corrente
  outflowCurrentMonth: number;  // saídas reais no mês corrente
  netCurrentMonth:    number;
  burnRate3m:         number;   // média mensal de saídas dos últimos 3 meses
  runway:             number;   // meses de operação com saldo actual (floor)
  mrr:                number;   // Monthly Recurring Revenue (contratos activos)
}

export interface GetCashflowOptions {
  bankAccount?: string;
  from?:        Date;
  to?:          Date;
  includeProjected?: boolean;
  groupBy?:     GroupBy;
}

// ── recalculateBalances ───────────────────────────────────────────────────────

/**
 * Recalcula CashMovement.balance em ordem cronológica para uma conta bancária.
 * Deve ser chamado em background após cada INFLOW ou OUTFLOW confirmado.
 *
 * Performance: só actualiza registos do movimento em diante (openingBalance fornecido
 * ou buscado do último movimento anterior ao primeiro afectado).
 *
 * @param bankAccount — conta a recalcular (default: BCS-MAIN)
 * @param fromDate    — data a partir da qual recalcular (default: hoje)
 */
export async function recalculateBalances(
  bankAccount = BANK_ACCOUNT,
  fromDate?: Date
) {
  const since = fromDate ? startOfDay(fromDate) : startOfDay(new Date());

  // Saldo do último movimento ANTES de fromDate
  const lastBefore = await prisma.cashMovement.findFirst({
    where:   { bankAccount, date: { lt: since } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select:  { balance: true },
  });
  let runningBalance = lastBefore?.balance ?? 0;

  // Todos os movimentos a partir de fromDate em ordem cronológica
  const movements = await prisma.cashMovement.findMany({
    where:   { bankAccount, date: { gte: since } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  // Actualizar saldos em batch via transaction
  if (movements.length === 0) return;

  await prisma.$transaction(
    movements.map((m) => {
      if (m.type === CashMovementType.INFLOW || m.type === CashMovementType.PROJECTED) {
        runningBalance = Math.round(runningBalance + m.amount);
      } else if (m.type === CashMovementType.OUTFLOW) {
        runningBalance = Math.round(runningBalance - m.amount);
      }
      // TRANSFER: depende da direcção — não altera o saldo nesta conta por simplificação
      return prisma.cashMovement.update({
        where: { id: m.id },
        data:  { balance: runningBalance },
      });
    })
  );
}

// ── getCashflowMovements ──────────────────────────────────────────────────────

/**
 * Listagem de movimentos de caixa com agrupamento opcional por dia/semana/mês.
 * Retorna sempre os movimentos raw + opcionalmente os agrupados.
 */
export async function getCashflowMovements(opts: GetCashflowOptions = {}) {
  const bankAccount      = opts.bankAccount      ?? BANK_ACCOUNT;
  const includeProjected = opts.includeProjected ?? false;
  const groupBy          = opts.groupBy;

  const where = {
    bankAccount,
    ...(opts.from || opts.to
      ? { date: {
          ...(opts.from && { gte: opts.from }),
          ...(opts.to   && { lte: opts.to   }),
        }}
      : {}),
    ...(includeProjected ? {} : { isProjected: false }),
  };

  const movements = await prisma.cashMovement.findMany({
    where,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      costCenter: { select: { code: true, name: true } },
    },
  });

  if (!groupBy) return { movements, groups: null };

  // Agrupar
  const grouped = new Map<string, CashflowPeriodEntry>();

  for (const m of movements) {
    const key   = periodKey(m.date, groupBy);
    const label = periodLabel(m.date, groupBy);

    if (!grouped.has(key)) {
      grouped.set(key, {
        periodKey:      key,
        periodLabel:    label,
        inflow:         0,
        outflow:        0,
        net:            0,
        closingBalance: 0,
      });
    }
    const entry = grouped.get(key)!;

    if (m.type === CashMovementType.INFLOW || m.type === CashMovementType.PROJECTED) {
      entry.inflow += m.amount;
    } else if (m.type === CashMovementType.OUTFLOW) {
      entry.outflow += m.amount;
    }
    entry.closingBalance = m.balance; // último balance do período
  }

  // Calcular net
  for (const entry of grouped.values()) {
    entry.net     = Math.round(entry.inflow - entry.outflow);
    entry.inflow  = Math.round(entry.inflow);
    entry.outflow = Math.round(entry.outflow);
  }

  return { movements, groups: [...grouped.values()] };
}

// ── getCashflowProjection ─────────────────────────────────────────────────────

/**
 * Projecção de cashflow para os próximos horizonDays dias.
 * Combina:
 *  1. Movimentos reais não projectados já registados no horizonte
 *  2. RentSchedules PENDING (entradas esperadas de contratos)
 *  3. Expenses recorrentes APPROVED (saídas esperadas)
 *
 * @param horizonDays — 30 | 60 | 90 (default: 90)
 */
export async function getCashflowProjection(opts: {
  horizonDays?: number;
  bankAccount?: string;
} = {}): Promise<CashflowProjectionEntry[]> {
  const horizonDays = opts.horizonDays ?? 90;
  const bankAccount = opts.bankAccount ?? BANK_ACCOUNT;
  const today       = startOfDay(new Date());
  const horizon     = addDays(today, horizonDays);

  // Saldo actual (último movimento real)
  const lastReal = await prisma.cashMovement.findFirst({
    where:   { bankAccount, isProjected: false, date: { lte: today } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select:  { balance: true },
  });
  let runningBalance = lastReal?.balance ?? 0;

  // Movimentos reais futuros já registados (mas ainda não processados)
  const realFuture = await prisma.cashMovement.findMany({
    where:   { bankAccount, isProjected: false, date: { gt: today, lte: horizon } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  // RentSchedules PENDING no horizonte
  const rentSchedules = await prisma.erpRentSchedule.findMany({
    where: {
      status:  "PENDING",
      dueDate: { gt: today, lte: horizon },
    },
    include: { contract: { select: { monthlyValue: true } } },
    orderBy: { dueDate: "asc" },
  });

  // Expenses recorrentes APPROVED com dueDate no horizonte
  const recurringExpenses = await prisma.erpExpense.findMany({
    where: {
      status:     ErpExpenseStatus.APPROVED,
      recurrence: { not: ExpenseRecurrence.NONE },
      dueDate:    { gt: today, lte: horizon },
      deletedAt:  null,
    },
    orderBy: { dueDate: "asc" },
  });

  // Construir lista combinada de entradas
  type RawEntry = {
    date:        Date;
    type:        CashMovementType;
    amount:      number;
    description: string;
    isProjected: boolean;
  };

  const entries: RawEntry[] = [];

  for (const m of realFuture) {
    entries.push({
      date:        m.date,
      type:        m.type,
      amount:      m.amount,
      description: m.description,
      isProjected: false,
    });
  }

  for (const rs of rentSchedules) {
    entries.push({
      date:        rs.dueDate,
      type:        CashMovementType.INFLOW,
      amount:      rs.amount,
      description: `Renda prevista — Contrato ${rs.contractId}`,
      isProjected: true,
    });
  }

  for (const exp of recurringExpenses) {
    entries.push({
      date:        exp.dueDate,
      type:        CashMovementType.OUTFLOW,
      amount:      exp.amount,
      description: `Despesa recorrente — ${exp.description}`,
      isProjected: true,
    });
  }

  // Ordenar por data
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calcular saldo cumulativo
  const result: CashflowProjectionEntry[] = entries.map((e) => {
    if (e.type === CashMovementType.INFLOW || e.type === CashMovementType.PROJECTED) {
      runningBalance = Math.round(runningBalance + e.amount);
    } else if (e.type === CashMovementType.OUTFLOW) {
      runningBalance = Math.round(runningBalance - e.amount);
    }
    return { ...e, runningBalance };
  });

  return result;
}

// ── getCashflowKpis ───────────────────────────────────────────────────────────

/**
 * KPIs de tesouraria para o dashboard financeiro.
 *
 * - currentBalance:      último CashMovement.balance real
 * - projectedBalance30:  saldo projectado em 30 dias (via projection)
 * - projectedBalance90:  saldo projectado em 90 dias
 * - inflowCurrentMonth:  soma de INFLOW reais no mês corrente
 * - outflowCurrentMonth: soma de OUTFLOW reais no mês corrente
 * - burnRate3m:          média mensal de OUTFLOW dos últimos 3 meses
 * - runway:              meses de operação com saldo actual
 * - mrr:                 soma de ErpContract.monthlyValue (contratos ACTIVE)
 */
export async function getCashflowKpis(bankAccount = BANK_ACCOUNT): Promise<CashflowKpis> {
  const today        = new Date();
  const monthStart   = startOfMonth(today);
  const threeMonAgo  = startOfMonth(addMonths(today, -3));

  const [lastMovement, inflowMonth, outflowMonth, outflow3m, activeContracts] =
    await prisma.$transaction([
      // Saldo actual
      prisma.cashMovement.findFirst({
        where:   { bankAccount, isProjected: false },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select:  { balance: true },
      }),
      // Entradas mês corrente
      prisma.cashMovement.aggregate({
        where:  { bankAccount, isProjected: false, type: CashMovementType.INFLOW,
                  date: { gte: monthStart } },
        _sum:   { amount: true },
      }),
      // Saídas mês corrente
      prisma.cashMovement.aggregate({
        where:  { bankAccount, isProjected: false, type: CashMovementType.OUTFLOW,
                  date: { gte: monthStart } },
        _sum:   { amount: true },
      }),
      // Saídas últimos 3 meses (para burn rate)
      prisma.cashMovement.aggregate({
        where:  { bankAccount, isProjected: false, type: CashMovementType.OUTFLOW,
                  date: { gte: threeMonAgo } },
        _sum:   { amount: true },
      }),
      // MRR — contratos ACTIVE
      prisma.erpContract.aggregate({
        where:  { status: "ACTIVE" },
        _sum:   { monthlyValue: true },
      }),
    ]);

  const currentBalance     = Math.round(lastMovement?.balance ?? 0);
  const inflowCurrentMonth = Math.round(inflowMonth._sum.amount  ?? 0);
  const outflowCurrentMonth= Math.round(outflowMonth._sum.amount ?? 0);
  const netCurrentMonth    = inflowCurrentMonth - outflowCurrentMonth;
  const mrr                = Math.round(activeContracts._sum.monthlyValue ?? 0);

  // Burn rate = média mensal de saídas nos últimos 3 meses
  const totalOutflow3m = outflow3m._sum.amount ?? 0;
  const burnRate3m     = Math.round(totalOutflow3m / 3);

  // Runway = meses de operação com saldo actual (divisão inteira)
  const runway = burnRate3m > 0 ? Math.floor(currentBalance / burnRate3m) : 999;

  // Projecção em 30 e 90 dias
  const proj30 = await getCashflowProjection({ horizonDays: 30,  bankAccount });
  const proj90 = await getCashflowProjection({ horizonDays: 90,  bankAccount });

  const projectedBalance30 = proj30.length > 0
    ? proj30[proj30.length - 1].runningBalance
    : currentBalance;
  const projectedBalance90 = proj90.length > 0
    ? proj90[proj90.length - 1].runningBalance
    : currentBalance;

  return {
    currentBalance,
    projectedBalance30,
    projectedBalance90,
    inflowCurrentMonth,
    outflowCurrentMonth,
    netCurrentMonth,
    burnRate3m,
    runway,
    mrr,
  };
}

// ── registerAdjustment ────────────────────────────────────────────────────────

/**
 * Regista ajuste manual de caixa (reconciliação bancária).
 * Cria CashMovement com type baseado no sinal do amount:
 *   amount > 0 → INFLOW (saldo estava sub-estimado)
 *   amount < 0 → OUTFLOW (saldo estava sobre-estimado)
 *
 * Após criar o movimento, dispara recalculateBalances().
 */
export async function registerAdjustment(input: {
  amount:      number;  // AOA — positivo ou negativo
  description: string;
  date:        Date;
  bankAccount?: string;
}, actorId: string) {
  const bankAccount = input.bankAccount ?? BANK_ACCOUNT;
  const absAmount   = Math.abs(Math.round(input.amount));
  const type        = input.amount >= 0
    ? CashMovementType.INFLOW
    : CashMovementType.OUTFLOW;

  if (absAmount === 0)
    throw new Error("O valor do ajuste não pode ser zero.");

  const movement = await prisma.$transaction(async (tx) => {
    return tx.cashMovement.create({
      data: {
        date:        input.date,
        type,
        amount:      absAmount,
        description: input.description,
        source:      CashMovementSource.ADJUSTMENT,
        isProjected: false,
        bankAccount,
        balance:     0, // recalculado a seguir
        createdBy:   actorId,
      },
    });
  });

  // Recalcular saldos a partir da data do ajuste
  await recalculateBalances(bankAccount, input.date);

  // Verificar saldo negativo projectado
  await detectNegativeBalance(bankAccount, actorId).catch(() => {});

  return movement;
}

// ── detectNegativeBalance ─────────────────────────────────────────────────────

/**
 * Verifica se o saldo projectado nos próximos 30 dias vai ficar negativo.
 * Se sim, cria ou actualiza um FinancialAlert NEGATIVE_BALANCE CRITICAL.
 * Se não, resolve o alerta existente se houver.
 */
export async function detectNegativeBalance(bankAccount = BANK_ACCOUNT, actorId = "SYSTEM") {
  const proj = await getCashflowProjection({ horizonDays: 30, bankAccount });

  // Encontrar o primeiro ponto de saldo negativo
  const negativeEntry = proj.find((e) => e.runningBalance < NEGATIVE_ALERT_THRESHOLD);

  if (!negativeEntry) {
    // Resolver alerta existente se houver
    await prisma.financialAlert.updateMany({
      where: {
        type:   AlertType.NEGATIVE_BALANCE,
        status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
      },
      data: { status: AlertStatus.RESOLVED, resolvedAt: new Date(), resolvedBy: "SYSTEM" },
    });
    return null;
  }

  const dateStr = format(negativeEntry.date, "dd/MM/yyyy");
  const amount  = Math.abs(negativeEntry.runningBalance);

  // Criar ou actualizar alerta
  const existing = await prisma.financialAlert.findFirst({
    where: {
      type:   AlertType.NEGATIVE_BALANCE,
      status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
    },
  });

  if (existing) {
    await prisma.financialAlert.update({
      where: { id: existing.id },
      data: {
        title:   `Saldo projectado negativo em ${dateStr}`,
        message: `O saldo projectado atingirá Kz -${amount.toLocaleString("pt-AO")} em ${dateStr}.`,
        updatedAt: new Date(),
      },
    });
    return existing;
  }

  const alert = await prisma.financialAlert.create({
    data: {
      type:     AlertType.NEGATIVE_BALANCE,
      severity: AlertSeverity.CRITICAL,
      status:   AlertStatus.ACTIVE,
      title:    `Saldo projectado negativo em ${dateStr}`,
      message:  `O saldo projectado atingirá Kz -${amount.toLocaleString("pt-AO")} em ${dateStr}. Acção urgente necessária.`,
    },
  });

  publish("erp.alert.created", {
    alertId:  alert.id,
    type:     AlertType.NEGATIVE_BALANCE,
    severity: AlertSeverity.CRITICAL,
    message:  alert.message,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  return alert;
}

// ── Utilitários de agrupamento ────────────────────────────────────────────────

function periodKey(date: Date, groupBy: GroupBy): string {
  if (groupBy === "day")   return format(date, "yyyy-MM-dd");
  if (groupBy === "week")  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-'W'II");
  return format(date, "yyyy-MM");
}

function periodLabel(date: Date, groupBy: GroupBy): string {
  if (groupBy === "day")   return format(date, "d MMM yyyy");
  if (groupBy === "week") {
    const wStart = startOfWeek(date, { weekStartsOn: 1 });
    return `Semana ${format(wStart, "w")} (${format(wStart, "d MMM")})`;
  }
  return format(date, "MMMM yyyy");
}
