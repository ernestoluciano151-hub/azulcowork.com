/**
 * erp-receivables-service.ts — Contas a Receber e a Pagar (Volume 02 — Sprint ERP-4)
 *
 * Operações:
 *  getArAging       — Aging de Contas a Receber (invoices ISSUED/SENT/OVERDUE/PARTIALLY_PAID)
 *                     Agrupado por empresa e por bucket (CURRENT / 30 / 60 / 90 / +90 dias)
 *  getApReport      — Relatório de Contas a Pagar (despesas APPROVED pendentes de pagamento)
 *                     Agrupado por categoria com dias em atraso
 *  getArSummary     — Totais AR por status (para dashboard)
 *  getOverdueInvoices — Listagem detalhada de faturas em atraso (por empresa)
 *
 * Definição de buckets AR:
 *  CURRENT  — vence hoje ou no futuro (daysOverdue ≤ 0)
 *  OVERDUE_30  — 1 a 30 dias em atraso
 *  OVERDUE_60  — 31 a 60 dias em atraso
 *  OVERDUE_90  — 61 a 90 dias em atraso
 *  OVERDUE_90P — mais de 90 dias em atraso
 *
 * Docs: docs/05-erp/billing.md · docs/05-erp/expenses.md · docs/05-erp/payments.md
 */

import { prisma }          from "@/lib/prisma";
import { ErpInvoiceStatus, ErpExpenseStatus } from "@prisma/client";

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type AgingBucket =
  | "CURRENT"
  | "OVERDUE_30"
  | "OVERDUE_60"
  | "OVERDUE_90"
  | "OVERDUE_90P";

export interface ArAgingLine {
  companyId:   string;
  companyName: string;
  nif:         string | null;
  invoiceId:   string;
  invoiceNumber: string;
  status:      ErpInvoiceStatus;
  dueDate:     Date;
  daysOverdue: number;
  bucket:      AgingBucket;
  total:       number;       // AOA — valor da fatura
  paid:        number;       // AOA — já recebido (pagamentos CONFIRMED)
  outstanding: number;       // AOA — em aberto = total - paid
}

export interface ArAgingBucketSummary {
  bucket:      AgingBucket;
  label:       string;
  count:       number;
  outstanding: number;       // AOA total em aberto neste bucket
}

export interface ArAgingReport {
  asOf:    Date;
  lines:   ArAgingLine[];
  buckets: ArAgingBucketSummary[];
  totalOutstanding: number;
}

export interface ApLine {
  expenseId:    string;
  description:  string;
  categoryName: string;
  accountCode:  string;
  supplierName: string | null;
  costCenterCode: string | null;
  dueDate:      Date;
  daysOverdue:  number;
  amount:       number;
  status:       ErpExpenseStatus;
}

export interface ApReport {
  asOf:         Date;
  lines:        ApLine[];
  totalPending: number;    // PENDING total
  totalApproved: number;   // APPROVED total (pronto a pagar)
  totalOverdue:  number;   // APPROVED em atraso
}

// ── Utilitários ───────────────────────────────────────────────────────────────

/** Dias em atraso em relação a hoje (> 0 = em atraso, ≤ 0 = a tempo / no futuro). */
function daysOverdue(dueDate: Date, asOf: Date): number {
  const ms = asOf.getTime() - dueDate.getTime();
  return Math.floor(ms / 86_400_000); // ms por dia
}

/** Atribui o bucket de aging com base nos dias em atraso. */
export function classifyBucket(days: number): AgingBucket {
  if (days <= 0)  return "CURRENT";
  if (days <= 30) return "OVERDUE_30";
  if (days <= 60) return "OVERDUE_60";
  if (days <= 90) return "OVERDUE_90";
  return "OVERDUE_90P";
}

const BUCKET_LABELS: Record<AgingBucket, string> = {
  CURRENT:     "A Vencer / Corrente",
  OVERDUE_30:  "1 – 30 dias em atraso",
  OVERDUE_60:  "31 – 60 dias em atraso",
  OVERDUE_90:  "61 – 90 dias em atraso",
  OVERDUE_90P: "+ 90 dias em atraso",
};

const BUCKET_ORDER: AgingBucket[] = [
  "CURRENT",
  "OVERDUE_30",
  "OVERDUE_60",
  "OVERDUE_90",
  "OVERDUE_90P",
];

// ── getArAging ────────────────────────────────────────────────────────────────

/**
 * Relatório de Aging de Contas a Receber.
 *
 * Inclui todas as faturas em aberto: ISSUED, SENT, OVERDUE, PARTIALLY_PAID.
 * Para cada fatura calcula o valor em aberto (total - pagamentos CONFIRMED).
 * Agrupa por empresa e por bucket de aging.
 *
 * @param companyId  — filtrar por empresa (opcional)
 * @param asOf       — data de referência (default: hoje)
 */
export async function getArAging(opts: {
  companyId?: string;
  asOf?:      Date;
} = {}): Promise<ArAgingReport> {
  const asOf = opts.asOf ?? new Date();

  const openStatuses: ErpInvoiceStatus[] = [
    ErpInvoiceStatus.ISSUED,
    ErpInvoiceStatus.SENT,
    ErpInvoiceStatus.OVERDUE,
    ErpInvoiceStatus.PARTIALLY_PAID,
  ];

  const invoices = await prisma.erpInvoice.findMany({
    where: {
      status:    { in: openStatuses },
      ...(opts.companyId && { companyId: opts.companyId }),
    },
    orderBy: { dueDate: "asc" },
    include: {
      company:    { select: { id: true, name: true, nif: true } },
      erpPayments: {
        where:  { status: "CONFIRMED" },
        select: { amount: true },
      },
    },
  });

  const lines: ArAgingLine[] = invoices.map((inv) => {
    const paid        = inv.erpPayments.reduce((s, p) => s + p.amount, 0);
    const outstanding = Math.max(0, inv.total - paid);
    const days        = daysOverdue(inv.dueDate, asOf);
    const bucket      = classifyBucket(days);

    return {
      companyId:     inv.companyId    ?? "",
      companyName:   inv.company?.name ?? "(sem empresa)",
      nif:           inv.company?.nif  ?? null,
      invoiceId:     inv.id,
      invoiceNumber: inv.number,
      status:        inv.status,
      dueDate:       inv.dueDate,
      daysOverdue:   days,
      bucket,
      total:         inv.total,
      paid:          Math.round(paid),
      outstanding:   Math.round(outstanding),
    };
  });

  // Sumarizar por bucket
  const bucketMap = new Map<AgingBucket, { count: number; outstanding: number }>();
  for (const b of BUCKET_ORDER) bucketMap.set(b, { count: 0, outstanding: 0 });

  for (const line of lines) {
    const entry = bucketMap.get(line.bucket)!;
    entry.count++;
    entry.outstanding += line.outstanding;
  }

  const buckets: ArAgingBucketSummary[] = BUCKET_ORDER.map((b) => ({
    bucket:      b,
    label:       BUCKET_LABELS[b],
    count:       bucketMap.get(b)!.count,
    outstanding: Math.round(bucketMap.get(b)!.outstanding),
  }));

  const totalOutstanding = Math.round(lines.reduce((s, l) => s + l.outstanding, 0));

  return { asOf, lines, buckets, totalOutstanding };
}

// ── getOverdueInvoices ────────────────────────────────────────────────────────

/**
 * Listagem de faturas em atraso com dias em atraso, ordenado por antiguidade DESC.
 * Usado pelo cron de alertas e pelo dashboard financeiro.
 */
export async function getOverdueInvoices(opts: {
  companyId?: string;
  minDaysOverdue?: number;
  asOf?:      Date;
} = {}) {
  const asOf          = opts.asOf ?? new Date();
  const minDays       = opts.minDaysOverdue ?? 1;

  const overdueStatuses: ErpInvoiceStatus[] = [
    ErpInvoiceStatus.OVERDUE,
    ErpInvoiceStatus.ISSUED,
    ErpInvoiceStatus.SENT,
    ErpInvoiceStatus.PARTIALLY_PAID,
  ];

  const invoices = await prisma.erpInvoice.findMany({
    where: {
      status:  { in: overdueStatuses },
      dueDate: { lt: asOf },
      ...(opts.companyId && { companyId: opts.companyId }),
    },
    orderBy: { dueDate: "asc" },
    include: {
      company:     { select: { id: true, name: true, nif: true, responsible: true, email: true } },
      erpPayments: { where: { status: "CONFIRMED" }, select: { amount: true } },
    },
  });

  return invoices
    .map((inv) => {
      const paid        = inv.erpPayments.reduce((s, p) => s + p.amount, 0);
      const outstanding = Math.max(0, inv.total - paid);
      const days        = daysOverdue(inv.dueDate, asOf);
      return {
        invoiceId:     inv.id,
        invoiceNumber: inv.number,
        status:        inv.status,
        companyId:     inv.companyId ?? "",
        companyName:   inv.company?.name ?? "(sem empresa)",
        responsible:   inv.company?.responsible ?? null,
        email:         inv.company?.email ?? null,
        dueDate:       inv.dueDate,
        daysOverdue:   days,
        bucket:        classifyBucket(days),
        total:         inv.total,
        outstanding:   Math.round(outstanding),
      };
    })
    .filter((r) => r.daysOverdue >= minDays)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// ── getArSummary ──────────────────────────────────────────────────────────────

/**
 * Totais AR por status — para widget do dashboard.
 */
export async function getArSummary() {
  const [issued, overdue, partiallyPaid, paid30d] = await prisma.$transaction([
    prisma.erpInvoice.aggregate({
      where:  { status: { in: [ErpInvoiceStatus.ISSUED, ErpInvoiceStatus.SENT] } },
      _sum:   { total: true },
      _count: true,
    }),
    prisma.erpInvoice.aggregate({
      where:  { status: ErpInvoiceStatus.OVERDUE },
      _sum:   { total: true },
      _count: true,
    }),
    prisma.erpInvoice.aggregate({
      where:  { status: ErpInvoiceStatus.PARTIALLY_PAID },
      _sum:   { total: true },
      _count: true,
    }),
    prisma.erpInvoice.aggregate({
      where: {
        status:  ErpInvoiceStatus.PAID,
        paidAt:  { gte: new Date(Date.now() - 30 * 86_400_000) },
      },
      _sum:  { total: true },
      _count: true,
    }),
  ]);

  return {
    issued:       { count: issued._count,       total: issued._sum.total       ?? 0 },
    overdue:      { count: overdue._count,       total: overdue._sum.total      ?? 0 },
    partiallyPaid:{ count: partiallyPaid._count, total: partiallyPaid._sum.total ?? 0 },
    paid30d:      { count: paid30d._count,       total: paid30d._sum.total      ?? 0 },
  };
}

// ── getApReport ───────────────────────────────────────────────────────────────

/**
 * Relatório de Contas a Pagar (Accounts Payable).
 * Inclui despesas PENDING e APPROVED (ainda não pagas).
 * Calcula dias em atraso para despesas APPROVED com dueDate no passado.
 */
export async function getApReport(opts: {
  categoryId?:  string;
  costCenterId?: string;
  asOf?:        Date;
} = {}): Promise<ApReport> {
  const asOf = opts.asOf ?? new Date();

  const expenses = await prisma.erpExpense.findMany({
    where: {
      status:   { in: [ErpExpenseStatus.PENDING, ErpExpenseStatus.APPROVED] },
      deletedAt: null,
      ...(opts.categoryId   && { categoryId:   opts.categoryId }),
      ...(opts.costCenterId && { costCenterId: opts.costCenterId }),
    },
    orderBy: { dueDate: "asc" },
    include: {
      category:   { select: { name: true, accountCode: true } },
      costCenter: { select: { code: true } },
    },
  });

  const lines: ApLine[] = expenses.map((exp) => {
    const days = daysOverdue(exp.dueDate, asOf);
    return {
      expenseId:      exp.id,
      description:    exp.description,
      categoryName:   exp.category.name,
      accountCode:    exp.category.accountCode,
      supplierName:   exp.supplierName,
      costCenterCode: exp.costCenter?.code ?? null,
      dueDate:        exp.dueDate,
      daysOverdue:    days,
      amount:         exp.amount,
      status:         exp.status,
    };
  });

  const totalPending  = Math.round(
    lines.filter(l => l.status === ErpExpenseStatus.PENDING)
         .reduce((s, l) => s + l.amount, 0)
  );
  const totalApproved = Math.round(
    lines.filter(l => l.status === ErpExpenseStatus.APPROVED)
         .reduce((s, l) => s + l.amount, 0)
  );
  const totalOverdue  = Math.round(
    lines.filter(l => l.status === ErpExpenseStatus.APPROVED && l.daysOverdue > 0)
         .reduce((s, l) => s + l.amount, 0)
  );

  return { asOf, lines, totalPending, totalApproved, totalOverdue };
}
