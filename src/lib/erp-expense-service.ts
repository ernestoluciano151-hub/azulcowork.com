/**
 * erp-expense-service.ts — Gestão de despesas ERP (Volume 02 — Sprint ERP-4)
 *
 * Operações:
 *  createErpExpense    — regista despesa PENDING ou APPROVED (auto, se ≤ Kz 50.000)
 *  approveErpExpense   — PENDING → APPROVED (ADMIN)
 *  rejectErpExpense    — PENDING → REJECTED (ADMIN)
 *  cancelErpExpense    — PENDING | APPROVED → CANCELLED
 *  payErpExpense       — APPROVED → PAID
 *                        + partida dupla no FinancialLedger (DEBIT 6xxx, CREDIT 1201)
 *                        + IVA dedutível se supplierNif presente (DEBIT 2312)
 *                        + CashMovement OUTFLOW
 *                        + TimelineEntry na Company (se companyId)
 *  listErpExpenses     — listagem com filtros
 *  getErpExpense       — detalhe com categoria, centro de custo e ledger
 *
 * Regras:
 *  - BR-FIN-008: amount ≤ 50.000 → auto-aprovado (APPROVED); > 50.000 → PENDING
 *  - IVA dedutível (conta 2312): activado quando supplierNif está preenchido
 *  - Toda operação de pagamento em prisma.$transaction()
 *  - Eventos publicados APÓS commit (.catch(() => {}))
 *  - ADR-021: FinancialLedger imutável — nunca UPDATE/DELETE
 *
 * Docs: docs/05-erp/expenses.md · docs/adr/README.md#adr-021
 */

import { prisma }                from "@/lib/prisma";
import { publish }               from "@/lib/event-bus";
import {
  ErpExpenseStatus,
  ExpenseRecurrence,
  LedgerType,
  CashMovementType,
  CashMovementSource,
  TimelineEventType,
} from "@prisma/client";
import { nanoid }                from "nanoid";

// ── Constantes ────────────────────────────────────────────────────────────────

/** Limite de aprovação automática (BR-FIN-008) — Kz 50.000 */
export const AUTO_APPROVE_LIMIT = 50_000;

/** Conta de IVA dedutível (PGC Angola) */
const ACCOUNT_IVA_DEDUCTIBLE = "2312";

/** Conta bancária BCS (saída) */
const ACCOUNT_BANK = "1201";

/** Taxa IVA para IVA dedutível em despesas — 14% (Lei 17/19) */
const IVA_RATE = 0.14;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CreateErpExpenseInput {
  categoryId:   string;
  costCenterId?: string;
  supplierName?: string;
  supplierNif?:  string;     // activa IVA dedutível
  description:  string;
  amount:        number;     // AOA
  dueDate:       Date;
  recurrence?:   ExpenseRecurrence;
  receiptUrl?:   string;     // Cloudinary
  notes?:        string;
  companyId?:    string;     // associar a empresa (ex: cobrança a inquilino)
}

export interface PayErpExpenseInput {
  paidAt:      Date;
  receiptUrl?: string;
  notes?:      string;
}

export interface ListErpExpensesOptions {
  categoryId?:  string;
  costCenterId?: string;
  status?:      ErpExpenseStatus;
  companyId?:   string;
  page?:        number;
  pageSize?:    number;
}

// ── createErpExpense ──────────────────────────────────────────────────────────

/**
 * Regista uma nova despesa.
 * BR-FIN-008: amount ≤ 50.000 → APPROVED automaticamente.
 *             amount >  50.000 → PENDING (aguarda aprovação ADMIN).
 */
export async function createErpExpense(
  input: CreateErpExpenseInput,
  actorId: string
) {
  // Verificar categoria
  const category = await prisma.expenseCategory.findUnique({
    where: { id: input.categoryId },
  });
  if (!category) throw new Error("Categoria de despesa não encontrada.");

  // Verificar CostCenter se fornecido
  if (input.costCenterId) {
    const cc = await prisma.costCenter.findUnique({ where: { id: input.costCenterId } });
    if (!cc) throw new Error("Centro de custo não encontrado.");
  }

  // BR-FIN-008: aprovação automática para valores ≤ 50.000 Kz
  const autoApproved = input.amount <= AUTO_APPROVE_LIMIT;
  const status       = autoApproved ? ErpExpenseStatus.APPROVED : ErpExpenseStatus.PENDING;

  const expense = await prisma.erpExpense.create({
    data: {
      categoryId:   input.categoryId,
      costCenterId: input.costCenterId,
      supplierName: input.supplierName,
      supplierNif:  input.supplierNif,
      description:  input.description,
      amount:       Math.round(input.amount),
      dueDate:      input.dueDate,
      recurrence:   input.recurrence ?? ExpenseRecurrence.NONE,
      receiptUrl:   input.receiptUrl,
      notes:        input.notes,
      companyId:    input.companyId,
      status,
      approvedBy:   autoApproved ? "SYSTEM" : undefined,
      approvedAt:   autoApproved ? new Date() : undefined,
      createdBy:    actorId,
    },
    include: { category: true, costCenter: true },
  });

  // Evento
  publish("erp.expense.created", { expenseId: expense.id, status, actorId }).catch(() => {});

  return expense;
}

// ── approveErpExpense ─────────────────────────────────────────────────────────

/**
 * Aprova despesa PENDING (ADMIN).
 * Despesas APPROVED ou PAID não podem ser re-aprovadas.
 */
export async function approveErpExpense(expenseId: string, actorId: string) {
  const expense = await prisma.erpExpense.findUnique({ where: { id: expenseId } });
  if (!expense)               throw new Error("Despesa não encontrada.");
  if (expense.deletedAt)      throw new Error("Despesa eliminada.");
  if (expense.status !== ErpExpenseStatus.PENDING)
    throw new Error(`Despesa não está em estado PENDING (estado actual: ${expense.status}).`);

  const updated = await prisma.erpExpense.update({
    where: { id: expenseId },
    data:  { status: ErpExpenseStatus.APPROVED, approvedBy: actorId, approvedAt: new Date() },
    include: { category: true, costCenter: true },
  });

  publish("erp.expense.approved", { expenseId, actorId }).catch(() => {});

  return updated;
}

// ── rejectErpExpense ──────────────────────────────────────────────────────────

export async function rejectErpExpense(
  expenseId: string,
  reason:    string,
  actorId:   string
) {
  const expense = await prisma.erpExpense.findUnique({ where: { id: expenseId } });
  if (!expense)          throw new Error("Despesa não encontrada.");
  if (expense.deletedAt) throw new Error("Despesa eliminada.");
  if (expense.status !== ErpExpenseStatus.PENDING)
    throw new Error(`Apenas despesas PENDING podem ser rejeitadas (actual: ${expense.status}).`);

  const updated = await prisma.erpExpense.update({
    where: { id: expenseId },
    data:  {
      status:         ErpExpenseStatus.REJECTED,
      rejectedBy:     actorId,
      rejectedReason: reason,
    },
    include: { category: true, costCenter: true },
  });

  publish("erp.expense.rejected", { expenseId, reason, actorId }).catch(() => {});

  return updated;
}

// ── cancelErpExpense ──────────────────────────────────────────────────────────

export async function cancelErpExpense(expenseId: string, actorId: string) {
  const expense = await prisma.erpExpense.findUnique({ where: { id: expenseId } });
  if (!expense)          throw new Error("Despesa não encontrada.");
  if (expense.deletedAt) throw new Error("Despesa eliminada.");

  const cancellable: ErpExpenseStatus[] = [
    ErpExpenseStatus.PENDING,
    ErpExpenseStatus.APPROVED,
  ];
  if (!cancellable.includes(expense.status))
    throw new Error(`Despesa em estado ${expense.status} não pode ser cancelada.`);

  const updated = await prisma.erpExpense.update({
    where: { id: expenseId },
    data:  { status: ErpExpenseStatus.CANCELLED },
    include: { category: true, costCenter: true },
  });

  publish("erp.expense.cancelled", { expenseId, actorId }).catch(() => {});

  return updated;
}

// ── payErpExpense ─────────────────────────────────────────────────────────────

/**
 * Regista o pagamento efectivo de uma despesa APPROVED.
 *
 * Em $transaction:
 *  1. Expense.status = PAID, paidAt = input.paidAt
 *  2. FinancialLedger (sem IVA dedutível):
 *       DEBIT  6xxx (Custo)     = amount
 *       CREDIT 1201 (Banco BCS) = amount
 *  3. FinancialLedger (com IVA dedutível, se supplierNif):
 *       DEBIT  6xxx (Custo s/IVA) = amount_sem_iva
 *       DEBIT  2312 (IVA ded.)    = iva_amount
 *       CREDIT 1201 (Banco BCS)   = total_pago
 *  4. CashMovement OUTFLOW
 *  5. TimelineEntry na Company (se companyId)
 */
export async function payErpExpense(
  expenseId: string,
  input:     PayErpExpenseInput,
  actorId:   string
) {
  const expense = await prisma.erpExpense.findUnique({
    where:   { id: expenseId },
    include: { category: true, costCenter: true },
  });
  if (!expense)          throw new Error("Despesa não encontrada.");
  if (expense.deletedAt) throw new Error("Despesa eliminada.");
  if (expense.status !== ErpExpenseStatus.APPROVED)
    throw new Error(`Apenas despesas APPROVED podem ser pagas (actual: ${expense.status}).`);

  const accountCode = expense.category.accountCode; // 6xxx PGC Angola
  const hasIva      = Boolean(expense.supplierNif);
  const totalAmount = Math.round(expense.amount);

  // Com IVA dedutível: total = base + iva → separar as parcelas
  const ivaAmount  = hasIva ? Math.round(totalAmount * IVA_RATE / (1 + IVA_RATE)) : 0;
  const baseAmount = totalAmount - ivaAmount; // custo sem IVA

  const paid = await prisma.$transaction(async (tx) => {
    // 1. Marcar despesa como PAID
    const updated = await tx.erpExpense.update({
      where: { id: expenseId },
      data:  {
        status:     ErpExpenseStatus.PAID,
        paidAt:     input.paidAt,
        receiptUrl: input.receiptUrl ?? expense.receiptUrl,
        notes:      input.notes      ?? expense.notes,
      } as Parameters<typeof tx.erpExpense.update>[0]["data"],
      include: { category: true, costCenter: true },
    });

    const entryDate = input.paidAt;
    const ref       = () => `EXP-${expenseId}-${nanoid(8)}`;

    if (hasIva) {
      // Partida dupla COM IVA dedutível:
      //   DEBIT  6xxx = base (custo s/IVA)
      //   DEBIT  2312 = ivaAmount (IVA dedutível)
      //   CREDIT 1201 = totalAmount (total saída de caixa)
      await tx.financialLedger.create({
        data: {
          entryDate,
          description: `Despesa paga (s/IVA) — ${expense.description}`,
          type:        LedgerType.DEBIT,
          amount:      baseAmount,
          accountCode,
          costCenterId: expense.costCenterId ?? undefined,
          companyId:   expense.companyId     ?? undefined,
          expenseId,
          reference:   ref(),
          createdBy:   actorId,
        },
      });
      await tx.financialLedger.create({
        data: {
          entryDate,
          description: `IVA dedutível — ${expense.description} (NIF: ${expense.supplierNif})`,
          type:        LedgerType.DEBIT,
          amount:      ivaAmount,
          accountCode: ACCOUNT_IVA_DEDUCTIBLE,
          costCenterId: expense.costCenterId ?? undefined,
          companyId:   expense.companyId     ?? undefined,
          expenseId,
          reference:   ref(),
          createdBy:   actorId,
        },
      });
      await tx.financialLedger.create({
        data: {
          entryDate,
          description: `Pagamento despesa — ${expense.description}`,
          type:        LedgerType.CREDIT,
          amount:      totalAmount,
          accountCode: ACCOUNT_BANK,
          costCenterId: expense.costCenterId ?? undefined,
          companyId:   expense.companyId     ?? undefined,
          expenseId,
          reference:   ref(),
          createdBy:   actorId,
        },
      });
    } else {
      // Partida dupla SEM IVA dedutível:
      //   DEBIT  6xxx = totalAmount
      //   CREDIT 1201 = totalAmount
      await tx.financialLedger.create({
        data: {
          entryDate,
          description: `Despesa paga — ${expense.description}`,
          type:        LedgerType.DEBIT,
          amount:      totalAmount,
          accountCode,
          costCenterId: expense.costCenterId ?? undefined,
          companyId:   expense.companyId     ?? undefined,
          expenseId,
          reference:   ref(),
          createdBy:   actorId,
        },
      });
      await tx.financialLedger.create({
        data: {
          entryDate,
          description: `Pagamento despesa — ${expense.description}`,
          type:        LedgerType.CREDIT,
          amount:      totalAmount,
          accountCode: ACCOUNT_BANK,
          costCenterId: expense.costCenterId ?? undefined,
          companyId:   expense.companyId     ?? undefined,
          expenseId,
          reference:   ref(),
          createdBy:   actorId,
        },
      });
    }

    // 4. CashMovement OUTFLOW
    await tx.cashMovement.create({
      data: {
        date:        input.paidAt,
        type:        CashMovementType.OUTFLOW,
        amount:      totalAmount,
        description: `Pagamento despesa — ${expense.description}`,
        source:      CashMovementSource.EXPENSE,
        sourceId:    expenseId,
        isProjected: false,
        bankAccount: "BCS-MAIN",
        balance:     0, // recalculado pelo serviço de cashflow (ERP-5)
        costCenterId: expense.costCenterId ?? undefined,
        createdBy:   actorId,
      },
    });

    // 5. TimelineEntry (se associada a empresa)
    if (expense.companyId) {
      await tx.timelineEntry.create({
        data: {
          companyId:   expense.companyId,
          eventType:   TimelineEventType.EXPENSE_PAID,
          title:       `Despesa paga — ${expense.description}`,
          description: `Valor: Kz ${totalAmount.toLocaleString("pt-AO")}`,
          amount:      totalAmount,
          createdBy:   actorId,
        },
      });
    }

    return updated;
  });

  // Eventos após commit
  publish("erp.expense.paid", { expenseId, amount: totalAmount, actorId }).catch(() => {});

  return paid;
}

// ── listErpExpenses ───────────────────────────────────────────────────────────

export async function listErpExpenses(opts: ListErpExpensesOptions = {}) {
  const page     = Math.max(1, opts.page     ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 20);
  const skip     = (page - 1) * pageSize;

  const where = {
    deletedAt:    null,
    ...(opts.categoryId   && { categoryId:   opts.categoryId }),
    ...(opts.costCenterId && { costCenterId: opts.costCenterId }),
    ...(opts.status       && { status:       opts.status }),
    ...(opts.companyId    && { companyId:    opts.companyId }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.erpExpense.findMany({
      where,
      orderBy: { dueDate: "asc" },
      skip,
      take:    pageSize,
      include: {
        category:   { select: { name: true, accountCode: true } },
        costCenter: { select: { code: true, name: true } },
      },
    }),
    prisma.erpExpense.count({ where }),
  ]);

  return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
}

// ── getErpExpense ─────────────────────────────────────────────────────────────

export async function getErpExpense(expenseId: string) {
  const expense = await prisma.erpExpense.findUnique({
    where:   { id: expenseId },
    include: {
      category:     true,
      costCenter:   true,
      ledgerEntries: {
        orderBy: { createdAt: "asc" },
        select:  { id: true, type: true, accountCode: true, amount: true, description: true, createdAt: true },
      },
    },
  });
  if (!expense || expense.deletedAt) throw new Error("Despesa não encontrada.");
  return expense;
}
