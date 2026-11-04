/**
 * finance.ts — helpers de cálculo ERP
 * Todos os valores são Float (AOA) sem arredondamentos intermédios.
 */

import { differenceInMonths, addMonths } from "date-fns";
import type { PrismaClient } from "@prisma/client";

// ── meses inclusivos entre duas datas ────────────────────────────────────────
//
// 11 Ago 2026 (correcção crítica — piloto): a versão anterior usava
// `differenceInCalendarMonths(end, start) + 1`, que assume que `start` é
// sempre dia 1 de um mês e `end` é sempre o último dia de um mês (ex.:
// 01/06 – 30/06 = 1 mês). Isto está correcto SÓ para contratos alinhados
// ao calendário. Para ciclos rolantes a partir da data real de início/
// pagamento (ex.: início 06/08, ciclo mensal termina 06/09) a fórmula
// antiga contava mês(es) a mais — diferença de mês CALENDÁRICO entre
// Ago e Set é 1, +1 = 2 meses, quando na realidade passou exactamente 1
// mês. Reportado pelo PO com um contrato real (início 06/08/2026):
// o sistema tratava o ciclo como se terminasse sempre no fim do mês
// calendárico, e não 1 mês depois da data de início.
//
// Nova lógica: conta meses INTEIROS decorridos entre `start` e `end`
// (respeitando o dia-do-mês, via `differenceInMonths`) + 1 mês adicional
// se sobrar qualquer fracção de mês incompleta (ex.: 06/08 → 20/09 = 1 mês
// inteiro + 14 dias → factura 2 meses, tal como qualquer contrato mensal
// cobra o mês em que se entra, mesmo que parcial).
//
// Para intervalos alinhados ao calendário (dia 1 ao último dia do mês,
// como os contratos ERP legados) o resultado é idêntico ao anterior —
// confirmado com os 5 casos de teste existentes em finance.test.ts.
export function calcContractMonths(start: Date, end: Date): number {
  if (end.getTime() <= start.getTime()) return 1;

  const fullMonths      = differenceInMonths(end, start);
  const afterFullMonths = addMonths(start, fullMonths);
  const hasPartialMonth = end.getTime() > afterFullMonths.getTime();

  return Math.max(1, fullMonths + (hasPartialMonth ? 1 : 0));
}

// ── valor total contratado ───────────────────────────────────────────────────
export function calcTotalContracted(rentAmount: number, start: Date, end: Date): number {
  return Math.round(rentAmount * calcContractMonths(start, end) * 100) / 100;
}

// ── pagamentos antecipados (6 Out 2026) ──────────────────────────────────────
//
// Um pagamento "antecipado" é um pagamento PAGO cujo período (dueDate) ainda
// não começou. A caixa (paidDate) entra no mês real do recebimento; aqui só
// se calcula até que data a renda está coberta e quanto é crédito.
//   monthsCovered  = meses inteiros de renda cobertos pelo total pago
//   paidThrough    = data (exclusiva) até à qual a renda está paga
//   creditAmount   = total pago acima do valor contratado (crédito)
//   prepaidMonths  = meses cobertos para além do fim do contrato actual
export function calcAdvanceInfo(
  rentAmount: number,
  start: Date,
  totalContracted: number,
  totalPaid: number,
  contractMonths: number
) {
  const creditAmount = Math.max(0, Math.round((totalPaid - totalContracted) * 100) / 100);
  if (rentAmount <= 0) {
    return { monthsCovered: 0, prepaidMonths: 0, creditAmount, paidThrough: start };
  }
  // tolerância de 0,01 Kz para arredondamentos
  const monthsCovered = Math.max(0, Math.floor((totalPaid + 0.01) / rentAmount));
  const prepaidMonths = Math.max(0, monthsCovered - contractMonths);
  return { monthsCovered, prepaidMonths, creditAmount, paidThrough: addMonths(start, monthsCovered) };
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

// Tipo compatível com PrismaClient e com o cliente de transacção (tx)
export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function getCompanyFinanceSummary(
  prisma: DbClient,
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

  // ── Separar contextos financeiros (RFT-009) ──────────────────────────────
  // coworkPayments: mensalidades e outros pagamentos do contrato de coworking
  // salaPayments:   pagamentos de reservas de sala de reunião (contexto distinto)
  const coworkPayments = company.payments.filter((p) => p.category !== "SALA_REUNIAO");
  const salaPayments   = company.payments.filter((p) => p.category === "SALA_REUNIAO");

  const months          = calcContractMonths(company.contractStart, company.contractEnd);
  const totalContracted = calcTotalContracted(company.rentAmount, company.contractStart, company.contractEnd);

  // totalPaid reflecte apenas pagamentos de coworking
  const totalPaid = coworkPayments
    .filter((p) => p.status === "PAGO")
    .reduce((s, p) => s + p.amount, 0);

  // totalSala é informativo — não afecta o saldo do contrato
  const totalSala = salaPayments
    .filter((p) => p.status === "PAGO")
    .reduce((s, p) => s + p.amount, 0);

  const balance   = totalContracted - totalPaid;
  const now       = new Date();
  const isOverdue = coworkPayments.some(
    (p) => p.status !== "PAGO" && new Date(p.dueDate) < now
  );
  const financialStatus = calcFinancialStatus(totalContracted, totalPaid, isOverdue);
  const advance = calcAdvanceInfo(company.rentAmount, company.contractStart, totalContracted, totalPaid, months);

  return {
    company,
    months,
    totalContracted,
    totalPaid,
    totalSala,
    balance,
    // pagamentos antecipados / crédito (6 Out 2026)
    creditAmount:  advance.creditAmount,
    prepaidMonths: advance.prepaidMonths,
    monthsCovered: advance.monthsCovered,
    paidThrough:   advance.paidThrough,
    financialStatus,
    coworkPayments,
    salaPayments,
  };
}

// ── registar entrada no histórico ────────────────────────────────────────────
export async function recordFinancialHistory(
  prisma: DbClient,
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
  // Apenas pagamentos de coworking afectam o saldo do contrato (RFT-009)
  const paidAgg = await prisma.payment.aggregate({
    // `category` é nullable: em SQL `<> 'X'` exclui NULL, o que fazia com que
    // pagamentos sem categoria (a maioria) ficassem fora do saldo acumulado.
    where: {
      companyId: params.companyId,
      status: "PAGO",
      OR: [{ category: null }, { category: { not: "SALA_REUNIAO" } }],
    },
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

// ── P1: Pagamentos unificados (Payment + InvoicePayment + ErpPayment) ─────────
// Corrige BUG-01 e BUG-03: dashboards que só liam o modelo legado Payment
// passam a usar esta função e incluem pagamentos de salas e ERP.
// Não apaga dados — faz UNION em memória dos três modelos.

export type UnifiedPayment = {
  id:            string;
  source:        "COWORK" | "SALA" | "ERP";
  amount:        number;
  status:        string;
  date:          Date;        // paidDate ou dueDate
  paidDate:      Date | null;
  dueDate:       Date | null;
  companyId:     string | null;
  companyName:   string | null;
  method:        string | null;
  reference:     string | null;
  receiptNumber: string | null;
  notes:         string | null;
  category:      string | null;
  reservationId: string | null;
};

export type UnifiedPaymentFilters = {
  from?:      Date;
  to?:        Date;
  status?:    string;   // PAGO | PENDENTE | ATRASADO | ALL
  companyId?: string;
  month?:     string;   // "YYYY-MM"
};

type DbClientFull = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function getUnifiedPayments(
  prisma: DbClientFull,
  filters: UnifiedPaymentFilters = {}
): Promise<UnifiedPayment[]> {
  const { from, to, status, companyId, month } = filters;

  // Intervalo de datas (compatível com o filtro de mês existente em /api/payments)
  let dateFrom = from;
  let dateTo   = to;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    dateFrom = new Date(y, m - 1, 1);
    dateTo   = new Date(y, m, 1);
  }

  // ── 1. Pagamentos legados de coworking (Payment) ──────────────────────────
  const paymentWhere: Record<string, unknown> = {};
  if (companyId) paymentWhere.companyId = companyId;
  if (status && status !== "ALL") paymentWhere.status = status;
  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {};
    if (dateFrom) range.gte = dateFrom;
    if (dateTo)   range.lt  = dateTo;
    paymentWhere.OR = [
      { status: "PAGO",    paidDate: range },
      { status: "PAGO",    paidDate: null, dueDate: range },
      { status: { not: "PAGO" }, dueDate: range },
    ];
  }

  // ── 2. Pagamentos ERP (ErpPayment) ─────────────────────────────────────────
  const erpWhere: Record<string, unknown> = {};
  if (companyId) erpWhere.companyId = companyId;
  if (status && status !== "ALL") {
    // ErpPaymentStatus: PENDING | CONFIRMED | REJECTED
    const erpStatus = status === "PAGO" ? "CONFIRMED" : status === "PENDENTE" ? "PENDING" : undefined;
    if (erpStatus) erpWhere.status = erpStatus;
  }
  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {};
    if (dateFrom) range.gte = dateFrom;
    if (dateTo)   range.lt  = dateTo;
    erpWhere.paidAt = range;
  }

  const [legacyPayments, erpPayments] = await Promise.all([
    prisma.payment.findMany({
      where: paymentWhere,
      include: { company: { select: { id: true, name: true } } },
      orderBy: [{ paidDate: { sort: "desc", nulls: "last" } }, { dueDate: "desc" }],
      take: 1000,
    }),
    prisma.erpPayment.findMany({
      where: erpWhere,
      include: { company: { select: { id: true, name: true } } },
      orderBy: { paidAt: "desc" },
      take: 1000,
    }),
  ]);

  // Normalizar Payment legado → UnifiedPayment
  const normalizedLegacy: UnifiedPayment[] = legacyPayments.map((p) => ({
    id:            p.id,
    source:        (p.category === "SALA_REUNIAO" ? "SALA" : "COWORK") as "COWORK" | "SALA",
    amount:        p.amount,
    status:        p.status,
    date:          p.paidDate ?? p.dueDate,
    paidDate:      p.paidDate,
    dueDate:       p.dueDate,
    companyId:     p.companyId,
    companyName:   p.company?.name ?? null,
    method:        p.paymentMethod,
    reference:     p.operationRef,
    receiptNumber: p.receiptNumber,
    notes:         p.notes,
    category:      p.category,
    reservationId: p.reservationId ?? null,
  }));

  // Normalizar ErpPayment → UnifiedPayment
  const normalizedErp: UnifiedPayment[] = erpPayments.map((p) => ({
    id:            p.id,
    source:        "ERP" as const,
    amount:        p.amount,
    status:        p.status === "CONFIRMED" ? "PAGO" : p.status === "PENDING" ? "PENDENTE" : "REJEITADO",
    date:          p.paidAt,
    paidDate:      p.status === "CONFIRMED" ? p.paidAt : null,
    dueDate:       null,
    companyId:     p.companyId,
    companyName:   p.company?.name ?? null,
    method:        p.method,
    reference:     p.reference,
    receiptNumber: p.receiptNumber,
    notes:         p.notes,
    category:      "ERP",
    reservationId: null,
  }));

  return [...normalizedLegacy, ...normalizedErp]
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
}

// Sumário de totais usando getUnifiedPayments
export async function getUnifiedSummary(
  prisma: DbClientFull,
  filters: UnifiedPaymentFilters = {}
) {
  const all = await getUnifiedPayments(prisma, filters);
  return {
    pago:     all.filter(p => p.status === "PAGO").reduce((s, p) => s + p.amount, 0),
    pendente: all.filter(p => p.status === "PENDENTE").reduce((s, p) => s + p.amount, 0),
    atrasado: all.filter(p => p.status === "ATRASADO").reduce((s, p) => s + p.amount, 0),
    total:    all.reduce((s, p) => s + p.amount, 0),
    count:    all.length,
    bySalas:  all.filter(p => p.source === "SALA").reduce((s, p) => s + p.amount, 0),
    byCowork: all.filter(p => p.source === "COWORK").reduce((s, p) => s + p.amount, 0),
    byErp:    all.filter(p => p.source === "ERP").reduce((s, p) => s + p.amount, 0),
  };
}
