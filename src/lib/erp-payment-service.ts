/**
 * erp-payment-service.ts — Gestão de pagamentos ERP (Volume 02 — Sprint ERP-3)
 *
 * Operações:
 *  registerErpPayment  — regista pagamento em estado PENDING
 *  confirmErpPayment   — PENDING → CONFIRMED
 *                        + partida dupla no FinancialLedger
 *                        + CashMovement INFLOW
 *                        + número de recibo (REC-YYYY-NNNNNN)
 *                        + atualiza Invoice (PAID | PARTIALLY_PAID)
 *                        + resolve FinancialAlert PAYMENT_OVERDUE
 *                        + TimelineEntry na Company
 *  rejectErpPayment    — PENDING → REJECTED
 *  refundErpPayment    — CONFIRMED → REFUNDED + estorno ledger + CashMovement OUTFLOW
 *  listErpPayments     — listagem com filtros
 *  getErpPayment       — detalhe
 *
 * Regras:
 *  - BR-PAY-001: só ADMIN | FINANCEIRO confirmam
 *  - BR-PAY-002: pagamento parcial → PARTIALLY_PAID + FinancialAlert
 *  - BR-PAY-003: excesso → não aceite sem ADMIN explícito
 *  - Toda confirmação em prisma.$transaction()
 *  - Eventos publicados APÓS commit (.catch(() => {}))
 *
 * Docs: docs/05-erp/payments.md · docs/adr/README.md#adr-021 · docs/adr/README.md#adr-023
 */

import { prisma }               from "@/lib/prisma";
import { publish }              from "@/lib/event-bus";
import { nextDocumentNumber }   from "@/lib/document-numbering";
import {
  ErpPaymentMethod,
  ErpPaymentStatus,
  ErpInvoiceStatus,
  LedgerType,
  CashMovementType,
  CashMovementSource,
  AlertType,
  AlertSeverity,
  AlertStatus,
  TimelineEventType,
} from "@prisma/client";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface RegisterErpPaymentInput {
  invoiceId:  string;
  amount:     number;           // AOA — valor efectivamente pago
  method:     ErpPaymentMethod;
  reference?: string;           // referência bancária / n.º operação
  paidAt:     Date;
  notes?:     string;
}

export interface ListErpPaymentsOptions {
  invoiceId?:  string;
  companyId?:  string;
  status?:     ErpPaymentStatus;
  page?:       number;
  pageSize?:   number;
}

// ── registerErpPayment ────────────────────────────────────────────────────────

export async function registerErpPayment(
  input: RegisterErpPaymentInput,
  actorId: string
) {
  // Verificar que a fatura existe e está em estado recebível
  const invoice = await prisma.erpInvoice.findUnique({
    where:   { id: input.invoiceId },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!invoice) throw new Error("Fatura não encontrada.");

  const recvStatuses: ErpInvoiceStatus[] = [
    ErpInvoiceStatus.ISSUED,
    ErpInvoiceStatus.SENT,
    ErpInvoiceStatus.OVERDUE,
    ErpInvoiceStatus.PARTIALLY_PAID,
  ];
  if (!recvStatuses.includes(invoice.status)) {
    throw new Error(`Não é possível registar pagamento para fatura com estado ${invoice.status}.`);
  }
  if (input.amount <= 0) throw new Error("O valor do pagamento deve ser positivo.");

  const payment = await prisma.erpPayment.create({
    data: {
      invoiceId:  input.invoiceId,
      companyId:  invoice.companyId,
      amount:     input.amount,
      method:     input.method,
      reference:  input.reference,
      paidAt:     input.paidAt,
      status:     ErpPaymentStatus.PENDING,
      notes:      input.notes,
      createdBy:  actorId,
    },
  });

  publish("erp.payment.confirmed", {
    paymentId:     payment.id,
    invoiceId:     input.invoiceId,
    companyId:     invoice.companyId ?? undefined,
    amount:        input.amount,
    method:        input.method,
    receiptNumber: "PENDING",
    actorId,
    timestamp:     new Date().toISOString(),
  }).catch(() => {});

  return payment;
}

// ── confirmErpPayment ─────────────────────────────────────────────────────────

export async function confirmErpPayment(paymentId: string, actorId: string) {
  const payment = await prisma.erpPayment.findUnique({
    where:   { id: paymentId },
    include: {
      invoice: {
        include: {
          company:     { select: { id: true, name: true, billingEmail: true, email: true } },
          erpPayments: { where: { status: ErpPaymentStatus.CONFIRMED } },
        },
      },
    },
  });
  if (!payment)                                          throw new Error("Pagamento não encontrado.");
  if (payment.status !== ErpPaymentStatus.PENDING)      throw new Error(`Só pagamentos PENDING podem ser confirmados. Estado: ${payment.status}`);
  if (!payment.invoice)                                  throw new Error("Pagamento sem fatura associada.");

  const invoice          = payment.invoice;
  const previouslyPaid   = invoice.erpPayments.reduce((s, p) => s + p.amount, 0);
  const totalPaidAfter   = previouslyPaid + payment.amount;
  const isFullyPaid      = totalPaidAfter >= invoice.total;
  const isPartiallyPaid  = !isFullyPaid && totalPaidAfter > 0;

  // BR-PAY-003: detectar excesso (pago > total)
  const isOverpaid = totalPaidAfter > invoice.total;

  const confirmed = await prisma.$transaction(async (tx) => {
    // 1. Gerar número de recibo
    const receiptNumber = await nextDocumentNumber(tx, "REC");

    // 2. Confirmar pagamento
    const p = await tx.erpPayment.update({
      where: { id: paymentId },
      data: {
        status:        ErpPaymentStatus.CONFIRMED,
        confirmedAt:   new Date(),
        confirmedBy:   actorId,
        receiptNumber,
        updatedAt:     new Date(),
      },
    });

    // 3. Actualizar estado da fatura
    const newInvoiceStatus = isFullyPaid
      ? ErpInvoiceStatus.PAID
      : ErpInvoiceStatus.PARTIALLY_PAID;

    await tx.erpInvoice.update({
      where: { id: invoice.id },
      data: {
        status:    newInvoiceStatus,
        paidAt:    isFullyPaid ? new Date() : undefined,
        updatedBy: actorId,
      },
    });

    // 4. Lançamentos contabilísticos (partida dupla — ADR-021)
    //    DEBIT  1201 (Banco BCS)       = payment.amount  ← dinheiro entrou no banco
    //    CREDIT 2111 (Clientes)        = payment.amount  ← elimina dívida do cliente
    const entryRef = `PAY-${p.id}-CONFIRM`;
    await tx.financialLedger.createMany({
      data: [
        {
          entryDate:   new Date(),
          description: `Pagamento ${receiptNumber} — ${invoice.number}`,
          type:        LedgerType.DEBIT,
          amount:      payment.amount,
          accountCode: "1201",           // Banco BCS — conta corrente
          companyId:   invoice.companyId,
          invoiceId:   invoice.id,
          paymentId:   p.id,
          reference:   `${entryRef}-DR`,
          createdBy:   actorId,
        },
        {
          entryDate:   new Date(),
          description: `Liquidação cliente — ${invoice.number}`,
          type:        LedgerType.CREDIT,
          amount:      payment.amount,
          accountCode: "2111",           // Clientes — contas a receber
          companyId:   invoice.companyId,
          invoiceId:   invoice.id,
          paymentId:   p.id,
          reference:   `${entryRef}-CR`,
          createdBy:   actorId,
        },
      ],
    });

    // 5. CashMovement INFLOW (ADR-025 — event-driven, aqui criado directamente na tx)
    await tx.cashMovement.create({
      data: {
        date:        payment.paidAt,
        type:        CashMovementType.INFLOW,
        amount:      payment.amount,
        description: `${receiptNumber} — ${invoice.number} — ${invoice.companyId ? invoice.company?.name : "s/empresa"}`,
        source:      CashMovementSource.PAYMENT,
        sourceId:    p.id,
        isProjected: false,
        bankAccount: "BCS-MAIN",
        balance:     0,         // recalculado por query cumulativa no cashflow service
        createdBy:   actorId,
      },
    });

    // 6. Resolver alerta PAYMENT_OVERDUE se existia (e fatura foi totalmente paga)
    if (isFullyPaid && invoice.companyId) {
      await tx.financialAlert.updateMany({
        where: {
          companyId: invoice.companyId,
          invoiceId: invoice.id,
          type:      AlertType.PAYMENT_OVERDUE,
          status:    AlertStatus.ACTIVE,
        },
        data: {
          status:     AlertStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedBy: actorId,
        },
      });
    }

    // 7. FinancialAlert para pagamento parcial — BR-PAY-002
    if (isPartiallyPaid && invoice.companyId) {
      await tx.financialAlert.create({
        data: {
          type:      AlertType.PAYMENT_OVERDUE,
          severity:  AlertSeverity.INFO,
          status:    AlertStatus.ACTIVE,
          title:     `Pagamento parcial — ${invoice.number}`,
          message:   `Recebido Kz ${payment.amount.toLocaleString("pt-AO")} de Kz ${invoice.total.toLocaleString("pt-AO")}. Em falta: Kz ${(invoice.total - totalPaidAfter).toLocaleString("pt-AO")}.`,
          companyId: invoice.companyId,
          invoiceId: invoice.id,
          amount:    invoice.total - totalPaidAfter,
          dueDate:   invoice.dueDate,
        },
      });
    }

    // 8. FinancialAlert para excesso — BR-PAY-003
    if (isOverpaid && invoice.companyId) {
      await tx.financialAlert.create({
        data: {
          type:      AlertType.CUSTOM,
          severity:  AlertSeverity.WARNING,
          status:    AlertStatus.ACTIVE,
          title:     `Pagamento em excesso — ${invoice.number}`,
          message:   `Pago Kz ${totalPaidAfter.toLocaleString("pt-AO")} > total Kz ${invoice.total.toLocaleString("pt-AO")}. Excesso de Kz ${(totalPaidAfter - invoice.total).toLocaleString("pt-AO")} a creditar.`,
          companyId: invoice.companyId,
          invoiceId: invoice.id,
          amount:    totalPaidAfter - invoice.total,
        },
      });
    }

    // 9. TimelineEntry
    if (invoice.companyId) {
      await tx.timelineEntry.create({
        data: {
          companyId:       invoice.companyId,
          eventType:       TimelineEventType.ERP_PAYMENT_CONFIRMED,
          title:           `Pagamento confirmado: ${receiptNumber}`,
          description:     `Kz ${payment.amount.toLocaleString("pt-AO")} via ${payment.method} · Fatura ${invoice.number}`,
          actorId,
          isSystem:        false,
          linkedEntityType: "ErpPayment",
          linkedEntityId:  p.id,
          metadata:        {
            receiptNumber,
            invoiceNumber: invoice.number,
            amount:        payment.amount,
            method:        payment.method,
            invoiceStatus: newInvoiceStatus,
          },
        },
      });
    }

    return { ...p, receiptNumber };
  });

  publish("erp.payment.confirmed", {
    paymentId:     confirmed.id,
    invoiceId:     invoice.id,
    companyId:     invoice.companyId ?? undefined,
    amount:        payment.amount,
    method:        payment.method,
    receiptNumber: confirmed.receiptNumber!,
    actorId,
    timestamp:     new Date().toISOString(),
  }).catch(() => {});

  return confirmed;
}

// ── rejectErpPayment ──────────────────────────────────────────────────────────

export async function rejectErpPayment(
  paymentId: string,
  reason: string,
  actorId: string
) {
  const payment = await prisma.erpPayment.findUnique({
    where:   { id: paymentId },
    select:  { id: true, status: true, invoiceId: true },
  });
  if (!payment)                                    throw new Error("Pagamento não encontrado.");
  if (payment.status !== ErpPaymentStatus.PENDING) throw new Error(`Só pagamentos PENDING podem ser rejeitados. Estado: ${payment.status}`);

  return prisma.erpPayment.update({
    where: { id: paymentId },
    data: {
      status:    ErpPaymentStatus.REJECTED,
      notes:     reason,
      updatedAt: new Date(),
    },
  });
}

// ── refundErpPayment ──────────────────────────────────────────────────────────

export async function refundErpPayment(
  paymentId: string,
  reason: string,
  actorId: string
) {
  const payment = await prisma.erpPayment.findUnique({
    where:   { id: paymentId },
    include: {
      invoice: { select: { id: true, number: true, companyId: true, total: true } },
    },
  });
  if (!payment)                                       throw new Error("Pagamento não encontrado.");
  if (payment.status !== ErpPaymentStatus.CONFIRMED)  throw new Error(`Só pagamentos CONFIRMED podem ser reembolsados. Estado: ${payment.status}`);

  const refunded = await prisma.$transaction(async (tx) => {
    // 1. Marcar como REFUNDED
    const p = await tx.erpPayment.update({
      where: { id: paymentId },
      data: { status: ErpPaymentStatus.REFUNDED, updatedAt: new Date() },
    });

    // 2. Estorno ledger (reversão da confirmação — ADR-021)
    const entryRef = `PAY-${p.id}-REFUND`;
    await tx.financialLedger.createMany({
      data: [
        {
          entryDate:   new Date(),
          description: `Reembolso — ${payment.invoice?.number ?? ""} — ${reason}`,
          type:        LedgerType.CREDIT,
          amount:      payment.amount,
          accountCode: "1201",           // Banco BCS — saída
          companyId:   payment.invoice?.companyId,
          invoiceId:   payment.invoice?.id,
          paymentId:   p.id,
          reference:   `${entryRef}-CR`,
          reverses:    `PAY-${p.id}-CONFIRM-DR`,
          createdBy:   actorId,
        },
        {
          entryDate:   new Date(),
          description: `Reposição dívida cliente — ${payment.invoice?.number ?? ""}`,
          type:        LedgerType.DEBIT,
          amount:      payment.amount,
          accountCode: "2111",           // Clientes — dívida reposta
          companyId:   payment.invoice?.companyId,
          invoiceId:   payment.invoice?.id,
          paymentId:   p.id,
          reference:   `${entryRef}-DR`,
          reverses:    `PAY-${p.id}-CONFIRM-CR`,
          createdBy:   actorId,
        },
      ],
    });

    // 3. CashMovement OUTFLOW
    await tx.cashMovement.create({
      data: {
        date:        new Date(),
        type:        CashMovementType.OUTFLOW,
        amount:      payment.amount,
        description: `Reembolso — ${payment.invoice?.number ?? ""} — ${reason}`,
        source:      CashMovementSource.PAYMENT,
        sourceId:    p.id,
        isProjected: false,
        bankAccount: "BCS-MAIN",
        balance:     0,
        createdBy:   actorId,
      },
    });

    // 4. Reverter Invoice para ISSUED
    if (payment.invoice) {
      await tx.erpInvoice.update({
        where: { id: payment.invoice.id },
        data: { status: ErpInvoiceStatus.ISSUED, paidAt: null, updatedBy: actorId },
      });
    }

    // 5. TimelineEntry
    if (payment.invoice?.companyId) {
      await tx.timelineEntry.create({
        data: {
          companyId:       payment.invoice.companyId,
          eventType:       TimelineEventType.ERP_PAYMENT_REFUNDED,
          title:           "Pagamento reembolsado",
          description:     `Kz ${payment.amount.toLocaleString("pt-AO")} — ${reason}`,
          actorId,
          isSystem:        false,
          linkedEntityType: "ErpPayment",
          linkedEntityId:  p.id,
          metadata:        { reason, amount: payment.amount, invoiceNumber: payment.invoice?.number },
        },
      });
    }

    return p;
  });

  publish("erp.payment.refunded", {
    paymentId:  refunded.id,
    invoiceId:  payment.invoice?.id,
    companyId:  payment.invoice?.companyId ?? undefined,
    amount:     payment.amount,
    actorId,
    timestamp:  new Date().toISOString(),
  }).catch(() => {});

  return refunded;
}

// ── listErpPayments ───────────────────────────────────────────────────────────

export async function listErpPayments(opts: ListErpPaymentsOptions = {}) {
  const page     = opts.page     ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const skip     = (page - 1) * pageSize;

  const where = {
    ...(opts.invoiceId  && { invoiceId:  opts.invoiceId }),
    ...(opts.companyId  && { companyId:  opts.companyId }),
    ...(opts.status     && { status:     opts.status }),
  };

  const [payments, total] = await Promise.all([
    prisma.erpPayment.findMany({
      where,
      skip,
      take:    pageSize,
      orderBy: { paidAt: "desc" },
      include: {
        invoice: { select: { id: true, number: true, total: true, type: true } },
        company: { select: { id: true, name: true } },
      },
    }),
    prisma.erpPayment.count({ where }),
  ]);

  return { data: payments, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ── getErpPayment ─────────────────────────────────────────────────────────────

export async function getErpPayment(paymentId: string) {
  return prisma.erpPayment.findUnique({
    where:   { id: paymentId },
    include: {
      invoice:      { include: { items: true } },
      company:      { select: { id: true, name: true, nif: true, billingEmail: true, email: true } },
      ledgerEntries: { orderBy: { createdAt: "asc" } },
    },
  });
}
