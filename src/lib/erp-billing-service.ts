/**
 * erp-billing-service.ts — Motor de faturação ERP (Volume 02)
 *
 * Operações:
 *  calculateIvaTotals  — calcula subtotal, taxAmount (14%) e total
 *  createErpInvoice    — cria fatura em estado DRAFT
 *  issueErpInvoice     — DRAFT → ISSUED + numeração atómica (FT-CWORK / FT-SALA / FT-SERV)
 *  voidErpInvoice      — ISSUED | SENT | OVERDUE → VOID + estorno no FinancialLedger
 *  listErpInvoices     — listagem com filtros
 *  getErpInvoice       — detalhe com items, pagamentos e ledger
 *
 * Regras:
 *  - IVA: 14% (Lei n.º 17/19 Angola) — BR-BILL-001
 *  - Numeração dentro de $transaction com nextDocumentNumber()
 *  - VOID exige ausência de pagamentos CONFIRMED — BR-BILL-002
 *  - Prazo padrão: 30 dias — BR-BILL-003
 *  - Eventos publicados APÓS commit (.catch(() => {}))
 *
 * Docs: docs/05-erp/billing.md · docs/adr/README.md#adr-021 · docs/adr/README.md#adr-023
 */

import { prisma }               from "@/lib/prisma";
import { publish }              from "@/lib/event-bus";
import { nextDocumentNumber }   from "@/lib/document-numbering";
import type { DocumentType }    from "@/lib/document-numbering";
import {
  ErpInvoiceType,
  ErpInvoiceStatus,
  LedgerType,
  TimelineEventType,
} from "@prisma/client";
import { addDays }              from "date-fns";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface InvoiceItemInput {
  description:  string;
  quantity:     number;   // ≥ 1
  unitPrice:    number;   // AOA
  accountCode:  string;   // PGC Angola (ex: "7111")
  costCenterId?: string;
}

export interface CreateErpInvoiceInput {
  type:        ErpInvoiceType;
  companyId?:  string;
  contractId?: string;
  bookingId?:  string;
  dueDate?:    Date;       // default: now + 30 dias (BR-BILL-003)
  items:       InvoiceItemInput[];
  notes?:      string;
}

export interface ListErpInvoicesOptions {
  companyId?:  string;
  status?:     ErpInvoiceStatus;
  type?:       ErpInvoiceType;
  page?:       number;
  pageSize?:   number;
}

// ── IVA ───────────────────────────────────────────────────────────────────────

/** Taxa IVA Angola — Lei n.º 17/19 */
export const IVA_RATE = 0.14;

/**
 * Calcula totais da fatura.
 * Arredondamento a inteiro (sem cêntimos — moeda AOA não tem fracções).
 */
export function calculateIvaTotals(itemsSubtotal: number, taxRate = IVA_RATE) {
  const subtotal  = Math.round(itemsSubtotal);
  const taxAmount = Math.round(subtotal * taxRate);
  const total     = subtotal + taxAmount;
  return { subtotal, taxAmount, taxRate, total };
}

/** Mapeia ErpInvoiceType → DocumentType para numeração. */
function invoiceTypeToDocType(type: ErpInvoiceType): DocumentType {
  switch (type) {
    case ErpInvoiceType.ROOM:    return "FT-SALA";
    case ErpInvoiceType.SERVICE:
    case ErpInvoiceType.EXPENSE_REIMBURSEMENT: return "FT-SERV";
    case ErpInvoiceType.COWORKING:
    case ErpInvoiceType.MIXED:
    default:                     return "FT-CWORK";
  }
}

/** Mapeia ErpInvoiceType → accountCode de receita (PGC Angola). */
function defaultAccountCode(type: ErpInvoiceType): string {
  switch (type) {
    case ErpInvoiceType.ROOM:    return "7121";
    case ErpInvoiceType.SERVICE: return "7131";
    default:                     return "7111";
  }
}

// ── createErpInvoice ──────────────────────────────────────────────────────────

export async function createErpInvoice(
  input: CreateErpInvoiceInput,
  actorId: string
) {
  if (!input.items || input.items.length === 0) {
    throw new Error("A fatura deve ter pelo menos um item.");
  }

  // Subtotal = soma de quantity * unitPrice de todos os items
  const itemsSubtotal = input.items.reduce(
    (acc, it) => acc + Math.round(it.quantity * it.unitPrice),
    0
  );
  if (itemsSubtotal <= 0) throw new Error("O valor total da fatura deve ser positivo.");

  const { subtotal, taxAmount, taxRate, total } = calculateIvaTotals(itemsSubtotal);
  const dueDate = input.dueDate ?? addDays(new Date(), 30); // BR-BILL-003

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.erpInvoice.create({
      data: {
        // number será preenchido em issueErpInvoice; aqui fica com placeholder temporário
        number:     `DRAFT-${Date.now()}`,
        type:       input.type,
        companyId:  input.companyId,
        contractId: input.contractId,
        bookingId:  input.bookingId,
        status:     ErpInvoiceStatus.DRAFT,
        issueDate:  new Date(),
        dueDate,
        subtotal,
        taxRate,
        taxAmount,
        total,
        notes:      input.notes,
        createdBy:  actorId,
        items: {
          create: input.items.map((it) => ({
            description:  it.description,
            quantity:     it.quantity,
            unitPrice:    Math.round(it.unitPrice),
            total:        Math.round(it.quantity * it.unitPrice),
            accountCode:  it.accountCode || defaultAccountCode(input.type),
            costCenterId: it.costCenterId,
          })),
        },
      },
      include: { items: true },
    });

    // TimelineEntry (se tiver companyId)
    if (input.companyId) {
      await tx.timelineEntry.create({
        data: {
          companyId:       input.companyId,
          eventType:       TimelineEventType.ERP_INVOICE_ISSUED,
          title:           "Fatura criada (rascunho)",
          description:     `Tipo: ${input.type} · Kz ${total.toLocaleString("pt-AO")} (c/ IVA)`,
          actorId,
          isSystem:        false,
          linkedEntityType: "ErpInvoice",
          linkedEntityId:  inv.id,
          metadata:        { type: input.type, total, status: "DRAFT" },
        },
      });
    }

    return inv;
  });

  publish("erp.invoice.created", {
    invoiceId: invoice.id,
    companyId: input.companyId,
    type:      input.type,
    total,
    actorId,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  return invoice;
}

// ── issueErpInvoice ───────────────────────────────────────────────────────────

export async function issueErpInvoice(invoiceId: string, actorId: string) {
  const existing = await prisma.erpInvoice.findUnique({
    where:   { id: invoiceId },
    include: { company: { select: { id: true, name: true, billingEmail: true, email: true } } },
  });
  if (!existing)                                       throw new Error("Fatura não encontrada.");
  if (existing.status !== ErpInvoiceStatus.DRAFT)     throw new Error(`Só faturas DRAFT podem ser emitidas. Estado: ${existing.status}`);

  const docType = invoiceTypeToDocType(existing.type);

  const issued = await prisma.$transaction(async (tx) => {
    // 1. Numeração atómica
    const number = await nextDocumentNumber(tx, docType);

    // 2. Transição DRAFT → ISSUED
    const inv = await tx.erpInvoice.update({
      where: { id: invoiceId },
      data: {
        number,
        status:    ErpInvoiceStatus.ISSUED,
        issueDate: new Date(),
        updatedBy: actorId,
      },
    });

    // 3. Lançamentos contabilísticos (partida dupla) — ADR-021
    //    DEBIT  2111 (Clientes a receber) = total
    //    CREDIT 7xxx (Receita)            = subtotal
    //    CREDIT 2311 (IVA a pagar)        = taxAmount
    const entryRef = `INV-${inv.id}-ISSUE`;
    await tx.financialLedger.createMany({
      data: [
        {
          entryDate:   new Date(),
          description: `Emissão fatura ${number}`,
          type:        LedgerType.DEBIT,
          amount:      inv.total,
          accountCode: "2111",    // Clientes
          companyId:   inv.companyId,
          invoiceId:   inv.id,
          reference:   `${entryRef}-DR`,
          createdBy:   actorId,
        },
        {
          entryDate:   new Date(),
          description: `Receita fatura ${number}`,
          type:        LedgerType.CREDIT,
          amount:      inv.subtotal,
          accountCode: defaultAccountCode(inv.type),
          companyId:   inv.companyId,
          invoiceId:   inv.id,
          reference:   `${entryRef}-CR-REC`,
          createdBy:   actorId,
        },
        {
          entryDate:   new Date(),
          description: `IVA fatura ${number}`,
          type:        LedgerType.CREDIT,
          amount:      inv.taxAmount,
          accountCode: "2311",    // IVA a pagar
          companyId:   inv.companyId,
          invoiceId:   inv.id,
          reference:   `${entryRef}-CR-IVA`,
          createdBy:   actorId,
        },
      ],
    });

    // 4. TimelineEntry
    if (inv.companyId) {
      await tx.timelineEntry.create({
        data: {
          companyId:       inv.companyId,
          eventType:       TimelineEventType.ERP_INVOICE_ISSUED,
          title:           `Fatura emitida: ${number}`,
          description:     `Kz ${inv.total.toLocaleString("pt-AO")} · Vence: ${inv.dueDate.toLocaleDateString("pt-AO")}`,
          actorId,
          isSystem:        false,
          linkedEntityType: "ErpInvoice",
          linkedEntityId:  inv.id,
          metadata:        { number, total: inv.total, dueDate: inv.dueDate, type: inv.type },
        },
      });
    }

    return inv;
  });

  publish("erp.invoice.issued", {
    invoiceId:     issued.id,
    invoiceNumber: issued.number,
    companyId:     issued.companyId ?? undefined,
    type:          issued.type,
    total:         issued.total,
    dueDate:       issued.dueDate.toISOString(),
    actorId,
    timestamp:     new Date().toISOString(),
  }).catch(() => {});

  return issued;
}

// ── voidErpInvoice ────────────────────────────────────────────────────────────

export async function voidErpInvoice(
  invoiceId: string,
  reason: string,
  actorId: string
) {
  const existing = await prisma.erpInvoice.findUnique({
    where:   { id: invoiceId },
    include: {
      erpPayments: { where: { status: "CONFIRMED" } },
    },
  });
  if (!existing) throw new Error("Fatura não encontrada.");

  const voidableStatuses: ErpInvoiceStatus[] = [
    ErpInvoiceStatus.ISSUED,
    ErpInvoiceStatus.SENT,
    ErpInvoiceStatus.OVERDUE,
  ];
  if (!voidableStatuses.includes(existing.status)) {
    throw new Error(`Não é possível anular uma fatura com estado ${existing.status}.`);
  }

  // BR-BILL-002: não pode anular se tiver pagamentos CONFIRMED
  if (existing.erpPayments.length > 0) {
    throw new Error("Não é possível anular uma fatura com pagamentos confirmados. Utilize um estorno de pagamento.");
  }

  const voided = await prisma.$transaction(async (tx) => {
    // 1. Transição → VOID
    const inv = await tx.erpInvoice.update({
      where: { id: invoiceId },
      data: {
        status:    ErpInvoiceStatus.VOID,
        voidedAt:  new Date(),
        voidedBy:  actorId,
        voidReason: reason,
        updatedBy: actorId,
      },
    });

    // 2. Estorno contabilístico (lançamentos reversivos — ADR-021)
    const entryRef = `INV-${inv.id}-VOID`;
    await tx.financialLedger.createMany({
      data: [
        {
          entryDate:   new Date(),
          description: `Estorno fatura ${inv.number} — ${reason}`,
          type:        LedgerType.CREDIT,
          amount:      inv.total,
          accountCode: "2111",
          companyId:   inv.companyId,
          invoiceId:   inv.id,
          reference:   `${entryRef}-CR`,
          reverses:    `INV-${inv.id}-ISSUE-DR`,
          createdBy:   actorId,
        },
        {
          entryDate:   new Date(),
          description: `Estorno receita ${inv.number}`,
          type:        LedgerType.DEBIT,
          amount:      inv.subtotal,
          accountCode: defaultAccountCode(inv.type),
          companyId:   inv.companyId,
          invoiceId:   inv.id,
          reference:   `${entryRef}-DR-REC`,
          reverses:    `INV-${inv.id}-ISSUE-CR-REC`,
          createdBy:   actorId,
        },
        {
          entryDate:   new Date(),
          description: `Estorno IVA ${inv.number}`,
          type:        LedgerType.DEBIT,
          amount:      inv.taxAmount,
          accountCode: "2311",
          companyId:   inv.companyId,
          invoiceId:   inv.id,
          reference:   `${entryRef}-DR-IVA`,
          reverses:    `INV-${inv.id}-ISSUE-CR-IVA`,
          createdBy:   actorId,
        },
      ],
    });

    // 3. TimelineEntry
    if (inv.companyId) {
      await tx.timelineEntry.create({
        data: {
          companyId:       inv.companyId,
          eventType:       TimelineEventType.ERP_INVOICE_VOIDED,
          title:           `Fatura anulada: ${inv.number}`,
          description:     reason,
          actorId,
          isSystem:        false,
          linkedEntityType: "ErpInvoice",
          linkedEntityId:  inv.id,
          metadata:        { number: inv.number, reason, total: inv.total },
        },
      });
    }

    return inv;
  });

  publish("erp.invoice.voided", {
    invoiceId:     voided.id,
    invoiceNumber: voided.number,
    companyId:     voided.companyId ?? undefined,
    reason,
    actorId,
    timestamp:     new Date().toISOString(),
  }).catch(() => {});

  return voided;
}

// ── listErpInvoices ───────────────────────────────────────────────────────────

export async function listErpInvoices(opts: ListErpInvoicesOptions = {}) {
  const page     = opts.page     ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const skip     = (page - 1) * pageSize;

  const where = {
    ...(opts.companyId && { companyId: opts.companyId }),
    ...(opts.status    && { status:    opts.status }),
    ...(opts.type      && { type:      opts.type }),
  };

  const [invoices, total] = await Promise.all([
    prisma.erpInvoice.findMany({
      where,
      skip,
      take:    pageSize,
      orderBy: { issueDate: "desc" },
      include: {
        company: { select: { id: true, name: true } },
        _count:  { select: { items: true, erpPayments: true } },
      },
    }),
    prisma.erpInvoice.count({ where }),
  ]);

  return { data: invoices, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ── getErpInvoice ─────────────────────────────────────────────────────────────

export async function getErpInvoice(invoiceId: string) {
  return prisma.erpInvoice.findUnique({
    where:   { id: invoiceId },
    include: {
      company:      { select: { id: true, name: true, nif: true, email: true, billingEmail: true } },
      items:        { orderBy: { createdAt: "asc" } },
      erpPayments:  { orderBy: { paidAt: "desc" } },
      ledgerEntries: { orderBy: { createdAt: "asc" } },
      rentSchedule: true,
    },
  });
}
