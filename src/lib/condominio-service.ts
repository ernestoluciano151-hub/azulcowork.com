/**
 * condominio-service.ts — Taxa de Condomínio (Atividades & Benefícios)
 *
 * Confirma o pagamento mensal da Taxa de Condomínio (9.500 Kz/mês, flat,
 * igual para todas as empresas SALA_PRIVADA) reaproveitando 100% o motor
 * financeiro ERP já existente (SSoT — zero duplicação de lógica de
 * numeração/ledger/cashflow):
 *
 *   createErpInvoice()  → ErpInvoice (DRAFT), tipo SERVICE
 *   issueErpInvoice()   → DRAFT → ISSUED, número FT-SERV-YYYY-NNNNNN
 *   registerErpPayment()→ ErpPayment (PENDING)
 *   confirmErpPayment() → PENDING → CONFIRMED, gera REC-YYYY-NNNNNN,
 *                          FinancialLedger (partida dupla), CashMovement,
 *                          TimelineEntry na empresa
 *
 * Idempotência: como não há campo dedicado "referenceMonth" no schema
 * (evitamos uma migração só para isto), identificamos a fatura do mês por
 * um marcador em ErpInvoice.notes (formato "CONDOMINIO:YYYY-MM").
 *
 * IVA: o motor de faturação ERP aplica sempre 14% (Lei 17/19) sobre o
 * item. Para que o total facturado continue a ser exactamente os 9.500 Kz
 * já comunicados na página Atividades (sem adicionar IVA por cima), o
 * preço-base do item é calculado por engenharia inversa em
 * baseAmountForFlatTotal().
 */

import { prisma } from "@/lib/prisma";
import {
  createErpInvoice,
  issueErpInvoice,
  IVA_RATE,
} from "@/lib/erp-billing-service";
import { registerErpPayment, confirmErpPayment } from "@/lib/erp-payment-service";
import { sendReceipt } from "@/lib/erp-communication-service";
import {
  ErpInvoiceType,
  ErpInvoiceStatus,
  ErpPaymentStatus,
  ErpPaymentMethod,
} from "@prisma/client";

export const CONDOMINIO_FEE_KZ = 9500;
const CONDOMINIO_ACCOUNT_CODE = "7131"; // PGC Angola — prestação de serviços

function condominioMarker(month: string): string {
  return `CONDOMINIO:${month}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  const label = d.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Calcula o preço-base (sem IVA) tal que, depois do motor de faturação
 * aplicar o IVA de 14%, o total dê exactamente `desiredTotal` — evita que
 * o cliente veja um valor diferente do anunciado (9.500 Kz) só porque
 * passou pelo motor de faturas.
 */
function baseAmountForFlatTotal(desiredTotal: number, taxRate = IVA_RATE): number {
  const approx = Math.round(desiredTotal / (1 + taxRate));
  for (let delta = -3; delta <= 3; delta++) {
    const candidate = approx + delta;
    const tax = Math.round(candidate * taxRate);
    if (candidate + tax === desiredTotal) return candidate;
  }
  return approx;
}

export interface CondominioStatus {
  invoiceId:      string;
  invoiceNumber:  string | null; // null enquanto DRAFT (sem número ainda)
  invoiceStatus:  ErpInvoiceStatus;
  paymentId:      string | null;
  paymentStatus:  ErpPaymentStatus | null;
  receiptNumber:  string | null;
  receiptUrl:     string | null;
  paidAt:         string | null;
  amount:         number;
}

/**
 * Estado da Taxa de Condomínio de um mês, por empresa — usado pelo GET de
 * /api/atividades para mostrar "Pago"/"Confirmar Pagamento" sem uma
 * segunda chamada de rede.
 */
export async function getCondominioStatusMap(
  companyIds: string[],
  month: string
): Promise<Record<string, CondominioStatus>> {
  if (companyIds.length === 0) return {};
  const marker = condominioMarker(month);

  const invoices = await prisma.erpInvoice.findMany({
    where: {
      companyId: { in: companyIds },
      type:      ErpInvoiceType.SERVICE,
      notes:     { startsWith: marker },
    },
    include: { erpPayments: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  const map: Record<string, CondominioStatus> = {};
  for (const inv of invoices) {
    if (!inv.companyId || map[inv.companyId]) continue; // mais recente primeiro, ignora duplicados antigos
    const confirmedPayment = inv.erpPayments.find(p => p.status === ErpPaymentStatus.CONFIRMED) ?? null;
    const latestPayment    = confirmedPayment ?? inv.erpPayments[0] ?? null;
    map[inv.companyId] = {
      invoiceId:     inv.id,
      invoiceNumber: inv.status === ErpInvoiceStatus.DRAFT ? null : inv.number,
      invoiceStatus: inv.status,
      paymentId:     latestPayment?.id ?? null,
      paymentStatus: latestPayment?.status ?? null,
      receiptNumber: confirmedPayment?.receiptNumber ?? null,
      receiptUrl:    confirmedPayment?.receiptUrl ?? null,
      paidAt:        confirmedPayment?.confirmedAt?.toISOString() ?? null,
      amount:        inv.total,
    };
  }
  return map;
}

export interface ConfirmCondominioInput {
  companyId:  string;
  month:      string; // YYYY-MM
  method:     ErpPaymentMethod;
  reference?: string;
  notes?:     string;
}

/**
 * Confirma o pagamento da Taxa de Condomínio de uma empresa para um mês.
 * Cria a fatura ERP se ainda não existir (idempotente via marcador em
 * notes), emite-a, regista o pagamento e confirma-o — tudo através dos
 * serviços ERP já existentes (mesma transaccionalidade/ledger/cashflow).
 */
export async function confirmCondominioPayment(
  input: ConfirmCondominioInput,
  actorId: string
) {
  const { companyId, month } = input;
  const marker = condominioMarker(month);

  const company = await prisma.company.findUnique({
    where:  { id: companyId },
    select: { id: true, name: true, category: true },
  });
  if (!company) throw new Error("Empresa não encontrada.");
  if (company.category === "SALA_REUNIAO") {
    throw new Error("Empresas de sala de reunião (sem contrato) não têm taxa de condomínio.");
  }

  let invoice = await prisma.erpInvoice.findFirst({
    where: {
      companyId,
      type:  ErpInvoiceType.SERVICE,
      notes: { startsWith: marker },
      status: { notIn: [ErpInvoiceStatus.VOID, ErpInvoiceStatus.CANCELLED] },
    },
    include: { erpPayments: true },
    orderBy: { createdAt: "desc" },
  });

  if (invoice) {
    const alreadyConfirmed = invoice.erpPayments.some(p => p.status === ErpPaymentStatus.CONFIRMED);
    if (alreadyConfirmed) {
      throw new Error(`A taxa de condomínio de ${monthLabel(month)} já está confirmada para ${company.name}.`);
    }
  }

  if (!invoice) {
    const baseAmount = baseAmountForFlatTotal(CONDOMINIO_FEE_KZ);
    const created = await createErpInvoice(
      {
        type:      ErpInvoiceType.SERVICE,
        companyId,
        items: [{
          description: `Taxa de Condomínio — ${monthLabel(month)}`,
          quantity:    1,
          unitPrice:   baseAmount,
          accountCode: CONDOMINIO_ACCOUNT_CODE,
        }],
        notes: marker,
      },
      actorId
    );
    invoice = await prisma.erpInvoice.findUniqueOrThrow({
      where:   { id: created.id },
      include: { erpPayments: true },
    });
  }

  if (invoice.status === ErpInvoiceStatus.DRAFT) {
    await issueErpInvoice(invoice.id, actorId);
    invoice = await prisma.erpInvoice.findUniqueOrThrow({
      where:   { id: invoice.id },
      include: { erpPayments: true },
    });
  }

  const pendingPayment = await registerErpPayment(
    {
      invoiceId: invoice.id,
      amount:    invoice.total, // sempre o total real da fatura (SSoT), não uma constante repetida
      method:    input.method,
      reference: input.reference,
      paidAt:    new Date(),
      notes:     input.notes,
    },
    actorId
  );

  const confirmedPayment = await confirmErpPayment(pendingPayment.id, actorId);

  // Gera já o PDF do recibo (e guarda no Cloudinary) para o admin poder
  // ver/descarregar de imediato — sem enviar email automaticamente (fica
  // ao critério do admin, ver botão "Enviar por email" na UI). Falha aqui
  // nunca deve desfazer o pagamento já confirmado — é best-effort.
  let receiptUrl: string | null = null;
  try {
    const receiptResult = await sendReceipt(confirmedPayment.id, { skipEmail: true });
    receiptUrl = receiptResult.pdfUrl;
  } catch (err) {
    console.error("[condominio-service] Falha ao gerar PDF do recibo:", err);
  }

  return { invoice, payment: { ...confirmedPayment, receiptUrl: receiptUrl ?? confirmedPayment.receiptUrl } };
}
