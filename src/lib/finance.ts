/**
 * finance.ts — helpers de cálculo ERP
 * Todos os valores são Float (AOA) sem arredondamentos intermédios.
 */

import { differenceInMonths, addMonths } from "date-fns";

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

  return {
    company,
    months,
    totalContracted,
    totalPaid,
    totalSala,
    balance,
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
    where: { companyId: params.companyId, status: "PAGO", category: { not: "SALA_REUNIAO" } },
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
