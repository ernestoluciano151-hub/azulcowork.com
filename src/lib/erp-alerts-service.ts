/**
 * erp-alerts-service.ts — Alertas Financeiros ERP (Volume 02 — Sprint ERP-6)
 *
 * Operações de detecção (chamadas pelo cron diário às 07:00 Africa/Luanda):
 *  checkPaymentOverdue      — faturas ISSUED/SENT/PARTIALLY_PAID com dueDate passada
 *                             WARNING após 1 dia; CRITICAL após 30 dias
 *  checkContractExpiring    — contratos ACTIVE com endDate em ≤ 60 dias
 *                             INFO em 60d; WARNING em 30d; CRITICAL em 7d
 *  checkContractExpired     — contratos ACTIVE com endDate passada → EXPIRED + CRITICAL
 *  checkDepositDue          — contratos com depositStatus=PENDING há > 15 dias → WARNING
 *  checkBudgetExceeded      — despesas do mês > orçamento do centro de custo
 *                             +15% → WARNING; +30% → CRITICAL
 *  processExpiredSnoozes    — SNOOZED com snoozedUntil < now → ACTIVE
 *
 * Operações de ciclo de vida (chamadas pelas API routes):
 *  acknowledgeAlert  — ACTIVE → ACKNOWLEDGED
 *  resolveAlert      — ACTIVE | ACKNOWLEDGED → RESOLVED
 *  snoozeAlert       — → SNOOZED com snoozedUntil
 *  createCustomAlert — alerta manual CUSTOM (ADMIN)
 *  listAlerts        — listagem com filtros
 *  getAlert          — detalhe
 *
 * Docs: docs/05-erp/alerts.md
 */

import { prisma }          from "@/lib/prisma";
import { publish }         from "@/lib/event-bus";
import {
  AlertType,
  AlertSeverity,
  AlertStatus,
  ContractStatus,
  DepositStatus,
  ErpInvoiceStatus,
  ErpExpenseStatus,
} from "@prisma/client";
import { addDays, startOfMonth, endOfMonth, differenceInDays, format } from "date-fns";

// ── Constantes ─────────────────────────────────────────────────────────────────

/** Dias em atraso para escalação WARNING → CRITICAL em faturas */
const OVERDUE_CRITICAL_DAYS = 30;

/** Janelas de aviso para contratos a expirar (em dias) */
const CONTRACT_WARN_WINDOWS = [60, 30, 7] as const;

/** Dias após criação do contrato para alertar caução não paga */
const DEPOSIT_DUE_DAYS = 15;

/** Limites de desvio orçamental: 15% → WARNING, 30% → CRITICAL */
const BUDGET_WARNING_PCT  = 1.15;
const BUDGET_CRITICAL_PCT = 1.30;

// ── checkPaymentOverdue ────────────────────────────────────────────────────────

/**
 * Detecção diária de faturas em atraso.
 * - Marca Invoice.status = OVERDUE
 * - Cria FinancialAlert PAYMENT_OVERDUE (WARNING)
 * - Escala para CRITICAL se > 30 dias em atraso
 * - Idempotente: não duplica alertas — usa upsert por invoiceId
 */
export async function checkPaymentOverdue() {
  const today = new Date();

  const overdueStatuses: ErpInvoiceStatus[] = [
    ErpInvoiceStatus.ISSUED,
    ErpInvoiceStatus.SENT,
    ErpInvoiceStatus.PARTIALLY_PAID,
    ErpInvoiceStatus.OVERDUE,
  ];

  const invoices = await prisma.erpInvoice.findMany({
    where: {
      status:  { in: overdueStatuses },
      dueDate: { lt: today },
    },
    include: {
      company: { select: { id: true, name: true } },
      erpPayments: { where: { status: "CONFIRMED" }, select: { amount: true } },
    },
  });

  const results = { checked: 0, created: 0, escalated: 0, skipped: 0 };

  for (const inv of invoices) {
    results.checked++;
    const daysLate  = differenceInDays(today, inv.dueDate);
    const paid      = inv.erpPayments.reduce((s, p) => s + p.amount, 0);
    const outstanding = Math.max(0, Math.round(inv.total - paid));

    if (outstanding === 0) {
      results.skipped++;
      continue; // já paga — será resolvida pelo confirmErpPayment
    }

    // Marcar fatura como OVERDUE se não estiver já
    if (inv.status !== ErpInvoiceStatus.OVERDUE && inv.status !== ErpInvoiceStatus.PARTIALLY_PAID) {
      await prisma.erpInvoice.update({
        where: { id: inv.id },
        data:  { status: ErpInvoiceStatus.OVERDUE },
      });
    }

    const severity = daysLate >= OVERDUE_CRITICAL_DAYS
      ? AlertSeverity.CRITICAL
      : AlertSeverity.WARNING;

    const title   = `Fatura ${inv.number} em atraso — ${daysLate} dia(s)`;
    const message = `Empresa: ${inv.company?.name ?? "(sem empresa)"}. `
      + `Valor em aberto: Kz ${outstanding.toLocaleString("pt-AO")}. `
      + `Vencimento: ${format(inv.dueDate, "dd/MM/yyyy")}.`;

    // Verificar se já existe alerta activo para esta fatura
    const existing = await prisma.financialAlert.findFirst({
      where: {
        type:      AlertType.PAYMENT_OVERDUE,
        invoiceId: inv.id,
        status:    { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED, AlertStatus.SNOOZED] },
      },
    });

    if (existing) {
      // Escalar severidade se necessário
      if (existing.severity !== severity) {
        await prisma.financialAlert.update({
          where: { id: existing.id },
          data:  { severity, title, message, amount: outstanding, dueDate: inv.dueDate },
        });
        results.escalated++;
      }
    } else {
      await prisma.financialAlert.create({
        data: {
          type:      AlertType.PAYMENT_OVERDUE,
          severity,
          status:    AlertStatus.ACTIVE,
          title,
          message,
          companyId: inv.companyId ?? undefined,
          invoiceId: inv.id,
          dueDate:   inv.dueDate,
          amount:    outstanding,
        },
      });
      results.created++;

      publish("erp.alert.created", {
        alertId:  inv.id, // será substituído pelo id real — simplificação
        type:     AlertType.PAYMENT_OVERDUE,
        severity,
        companyId: inv.companyId ?? undefined,
        message,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  return results;
}

// ── checkContractExpiring ──────────────────────────────────────────────────────

/**
 * Detecção diária de contratos a expirar.
 * Janelas: 60 → INFO, 30 → WARNING, 7 → CRITICAL.
 * Idempotente: actualiza severidade se já existir alerta.
 */
export async function checkContractExpiring() {
  const today = new Date();

  const contracts = await prisma.erpContract.findMany({
    where: {
      status:  ContractStatus.ACTIVE,
      endDate: {
        not:  null,
        gte:  today,
        lte:  addDays(today, 60),
      },
    },
    include: { company: { select: { id: true, name: true } } },
  });

  const results = { checked: 0, created: 0, escalated: 0 };

  for (const contract of contracts) {
    if (!contract.endDate) continue;
    results.checked++;

    const daysLeft = differenceInDays(contract.endDate, today);
    let severity: AlertSeverity;

    if      (daysLeft <= 7)  severity = AlertSeverity.CRITICAL;
    else if (daysLeft <= 30) severity = AlertSeverity.WARNING;
    else                     severity = AlertSeverity.INFO;

    const title   = `Contrato a expirar — ${contract.company?.name ?? ""} (${daysLeft} dia(s))`;
    const message = `Contrato de ${contract.company?.name ?? "empresa"} expira em `
      + `${format(contract.endDate, "dd/MM/yyyy")}. `
      + `Valor mensal: Kz ${Math.round(contract.monthlyValue).toLocaleString("pt-AO")}. `
      + (contract.autoRenew ? "Renovação automática activada." : "Sem renovação automática — acção necessária.");

    const existing = await prisma.financialAlert.findFirst({
      where: {
        type:       AlertType.CONTRACT_EXPIRING,
        contractId: contract.id,
        status:     { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED, AlertStatus.SNOOZED] },
      },
    });

    if (existing) {
      if (existing.severity !== severity) {
        await prisma.financialAlert.update({
          where: { id: existing.id },
          data:  { severity, title, message },
        });
        results.escalated++;
      }
    } else {
      await prisma.financialAlert.create({
        data: {
          type:       AlertType.CONTRACT_EXPIRING,
          severity,
          status:     AlertStatus.ACTIVE,
          title,
          message,
          companyId:  contract.companyId,
          contractId: contract.id,
          dueDate:    contract.endDate,
          amount:     contract.monthlyValue,
        },
      });
      results.created++;

      publish("erp.alert.created", {
        alertId:   contract.id,
        type:      AlertType.CONTRACT_EXPIRING,
        severity,
        companyId: contract.companyId,
        message,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  return results;
}

// ── checkContractExpired ───────────────────────────────────────────────────────

/**
 * Detecta contratos ACTIVE com endDate passada.
 * Marca status = EXPIRED e cria alerta CRITICAL.
 */
export async function checkContractExpired() {
  const today = new Date();

  const expired = await prisma.erpContract.findMany({
    where: {
      status:  ContractStatus.ACTIVE,
      endDate: { lt: today, not: null },
    },
    include: { company: { select: { id: true, name: true } } },
  });

  const results = { checked: expired.length, expired: 0 };

  for (const contract of expired) {
    if (!contract.endDate) continue;

    // Marcar contrato como EXPIRED
    await prisma.erpContract.update({
      where: { id: contract.id },
      data:  { status: ContractStatus.EXPIRED },
    });

    const existing = await prisma.financialAlert.findFirst({
      where: {
        type:       AlertType.CONTRACT_EXPIRED,
        contractId: contract.id,
        status:     { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
      },
    });

    if (!existing) {
      await prisma.financialAlert.create({
        data: {
          type:       AlertType.CONTRACT_EXPIRED,
          severity:   AlertSeverity.CRITICAL,
          status:     AlertStatus.ACTIVE,
          title:      `Contrato expirado — ${contract.company?.name ?? ""}`,
          message:    `O contrato de ${contract.company?.name ?? "empresa"} expirou em `
            + `${format(contract.endDate, "dd/MM/yyyy")}. `
            + "Acção imediata necessária: renovar ou encerrar formalmente.",
          companyId:  contract.companyId,
          contractId: contract.id,
          dueDate:    contract.endDate,
          amount:     contract.monthlyValue,
        },
      });
    }

    results.expired++;
  }

  return results;
}

// ── checkDepositDue ────────────────────────────────────────────────────────────

/**
 * Contratos com caução (depositAmount > 0) não paga há > 15 dias após criação.
 */
export async function checkDepositDue() {
  const cutoff = addDays(new Date(), -DEPOSIT_DUE_DAYS);

  const contracts = await prisma.erpContract.findMany({
    where: {
      status:        { in: [ContractStatus.ACTIVE, ContractStatus.DRAFT] },
      depositStatus: DepositStatus.PENDING,
      depositAmount: { gt: 0 },
      createdAt:     { lt: cutoff },
    },
    include: { company: { select: { id: true, name: true } } },
  });

  const results = { checked: contracts.length, created: 0 };

  for (const contract of contracts) {
    const existing = await prisma.financialAlert.findFirst({
      where: {
        type:       AlertType.DEPOSIT_DUE,
        contractId: contract.id,
        status:     { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED, AlertStatus.SNOOZED] },
      },
    });

    if (!existing) {
      await prisma.financialAlert.create({
        data: {
          type:       AlertType.DEPOSIT_DUE,
          severity:   AlertSeverity.WARNING,
          status:     AlertStatus.ACTIVE,
          title:      `Caução por receber — ${contract.company?.name ?? ""}`,
          message:    `A caução de Kz ${Math.round(contract.depositAmount).toLocaleString("pt-AO")} `
            + `do contrato de ${contract.company?.name ?? "empresa"} ainda não foi recebida.`,
          companyId:  contract.companyId,
          contractId: contract.id,
          amount:     contract.depositAmount,
        },
      });
      results.created++;
    }
  }

  return results;
}

// ── checkBudgetExceeded ────────────────────────────────────────────────────────

/**
 * Compara despesas reais do mês corrente com o orçamento de cada centro de custo.
 * Chamado ao aprovar ou pagar uma despesa, e também no cron diário.
 *
 * @param costCenterId — verificar apenas este centro (optional; default: todos)
 */
export async function checkBudgetExceeded(costCenterId?: string) {
  const now        = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);

  const costCenters = await prisma.costCenter.findMany({
    where: {
      isActive: true,
      budget:   { not: null, gt: 0 },
      ...(costCenterId && { id: costCenterId }),
    },
  });

  const results = { checked: costCenters.length, alerts: 0 };

  for (const cc of costCenters) {
    if (!cc.budget) continue;

    // Soma de despesas PAID no mês corrente neste centro
    const agg = await prisma.erpExpense.aggregate({
      where: {
        costCenterId: cc.id,
        status:       ErpExpenseStatus.PAID,
        paidAt:       { gte: monthStart, lte: monthEnd },
        deletedAt:    null,
      },
      _sum: { amount: true },
    });

    const totalReal = Math.round(agg._sum.amount ?? 0);
    const ratio     = cc.budget > 0 ? totalReal / cc.budget : 0;

    if (ratio < BUDGET_WARNING_PCT) continue; // dentro do orçamento

    const severity = ratio >= BUDGET_CRITICAL_PCT
      ? AlertSeverity.CRITICAL
      : AlertSeverity.WARNING;

    const pct     = Math.round((ratio - 1) * 100);
    const title   = `Orçamento excedido — ${cc.name} (+${pct}%)`;
    const message = `Centro de custo ${cc.name}: gasto real Kz ${totalReal.toLocaleString("pt-AO")} `
      + `vs orçamento Kz ${Math.round(cc.budget).toLocaleString("pt-AO")} `
      + `(+${pct}% — ${format(now, "MMMM yyyy")}).`;

    const existing = await prisma.financialAlert.findFirst({
      where: {
        type:   AlertType.BUDGET_EXCEEDED,
        status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
        message: { contains: cc.name },
      },
    });

    if (existing) {
      if (existing.severity !== severity || existing.amount !== totalReal) {
        await prisma.financialAlert.update({
          where: { id: existing.id },
          data:  { severity, title, message, amount: totalReal },
        });
      }
    } else {
      await prisma.financialAlert.create({
        data: {
          type:     AlertType.BUDGET_EXCEEDED,
          severity,
          status:   AlertStatus.ACTIVE,
          title,
          message,
          amount:   totalReal,
        },
      });
      results.alerts++;
    }
  }

  return results;
}

// ── processExpiredSnoozes ──────────────────────────────────────────────────────

/**
 * Reactiva alertas SNOOZED cujo snoozedUntil já passou.
 * Chamado no início do cron diário.
 */
export async function processExpiredSnoozes() {
  const result = await prisma.financialAlert.updateMany({
    where: {
      status:      AlertStatus.SNOOZED,
      snoozedUntil: { lt: new Date() },
    },
    data: { status: AlertStatus.ACTIVE, snoozedUntil: null },
  });
  return { reactivated: result.count };
}

// ── acknowledgeAlert ───────────────────────────────────────────────────────────

export async function acknowledgeAlert(alertId: string, actorId: string) {
  const alert = await prisma.financialAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alerta não encontrado.");
  if (alert.status !== AlertStatus.ACTIVE)
    throw new Error(`Apenas alertas ACTIVE podem ser reconhecidos (actual: ${alert.status}).`);

  return prisma.financialAlert.update({
    where: { id: alertId },
    data:  { status: AlertStatus.ACKNOWLEDGED, acknowledgedAt: new Date(), acknowledgedBy: actorId },
  });
}

// ── resolveAlert ───────────────────────────────────────────────────────────────

export async function resolveAlert(alertId: string, actorId: string) {
  const alert = await prisma.financialAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alerta não encontrado.");

  const resolvable: AlertStatus[] = [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED, AlertStatus.SNOOZED];
  if (!resolvable.includes(alert.status))
    throw new Error(`Alerta já está em estado ${alert.status}.`);

  const resolved = await prisma.financialAlert.update({
    where: { id: alertId },
    data:  { status: AlertStatus.RESOLVED, resolvedAt: new Date(), resolvedBy: actorId },
  });

  publish("erp.alert.resolved", {
    alertId,
    type:      alert.type,
    actorId,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  return resolved;
}

// ── snoozeAlert ────────────────────────────────────────────────────────────────

export async function snoozeAlert(alertId: string, days: number, actorId: string) {
  if (days < 1 || days > 90)
    throw new Error("O snooze deve ser entre 1 e 90 dias.");

  const alert = await prisma.financialAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alerta não encontrado.");

  const snoozable: AlertStatus[] = [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED];
  if (!snoozable.includes(alert.status))
    throw new Error(`Alerta em estado ${alert.status} não pode ser adiado.`);

  return prisma.financialAlert.update({
    where: { id: alertId },
    data:  { status: AlertStatus.SNOOZED, snoozedUntil: addDays(new Date(), days) },
  });
}

// ── createCustomAlert ──────────────────────────────────────────────────────────

export interface CreateCustomAlertInput {
  title:      string;
  message:    string;
  severity?:  AlertSeverity;
  companyId?: string;
  dueDate?:   Date;
  amount?:    number;
}

export async function createCustomAlert(input: CreateCustomAlertInput) {
  if (!input.title.trim())   throw new Error("title é obrigatório.");
  if (!input.message.trim()) throw new Error("message é obrigatória.");

  return prisma.financialAlert.create({
    data: {
      type:      AlertType.CUSTOM,
      severity:  input.severity  ?? AlertSeverity.INFO,
      status:    AlertStatus.ACTIVE,
      title:     input.title.trim(),
      message:   input.message.trim(),
      companyId: input.companyId,
      dueDate:   input.dueDate,
      amount:    input.amount !== undefined ? Math.round(input.amount) : undefined,
    },
  });
}

// ── listAlerts ─────────────────────────────────────────────────────────────────

export interface ListAlertsOptions {
  type?:      AlertType;
  severity?:  AlertSeverity;
  status?:    AlertStatus;
  companyId?: string;
  page?:      number;
  pageSize?:  number;
}

export async function listAlerts(opts: ListAlertsOptions = {}) {
  const page     = Math.max(1, opts.page     ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 20);
  const skip     = (page - 1) * pageSize;

  const where = {
    ...(opts.type      && { type:      opts.type      }),
    ...(opts.severity  && { severity:  opts.severity  }),
    ...(opts.status    && { status:    opts.status    }),
    ...(opts.companyId && { companyId: opts.companyId }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.financialAlert.findMany({
      where,
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      skip,
      take:    pageSize,
      include: {
        company: { select: { id: true, name: true } },
      },
    }),
    prisma.financialAlert.count({ where }),
  ]);

  return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
}

// ── getAlert ───────────────────────────────────────────────────────────────────

export async function getAlert(alertId: string) {
  const alert = await prisma.financialAlert.findUnique({
    where:   { id: alertId },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!alert) throw new Error("Alerta não encontrado.");
  return alert;
}
