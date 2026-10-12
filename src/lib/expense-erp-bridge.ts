/**
 * expense-erp-bridge.ts — Ponte Despesas (CRM) → ERP (12 Out 2026)
 *
 * Quando uma despesa do CRM (`Expense`) passa a PAGO, regista o mesmo pagamento no ERP
 * reutilizando `payErpExpense` (SSoT da contabilização): ErpExpense PAID +
 * FinancialLedger (partida dobrada) + CashMovement OUTFLOW. Assim o ERP (cashflow,
 * dashboard, reconciliação, relatórios) passa a ver as despesas pagas no CRM.
 *
 * - Idempotente: `Expense.erpExpenseId` + marcador `LEGACY_EXPENSE:<id>` em ErpExpense.notes.
 * - Livro imutável (ADR-021): despesas já sincronizadas não podem ser reabertas nem ter
 *   valor/data/categoria alterados (as rotas bloqueiam).
 * - Sem NIF do fornecedor no CRM → sem IVA dedutível.
 */
import { prisma } from "@/lib/prisma";
import { ErpExpenseStatus } from "@prisma/client";
import { payErpExpense } from "@/lib/erp-expense-service";
import { recalculateBalances } from "@/lib/erp-cashflow-service";

/** Conta PGC por categoria do CRM — a confirmar com o contabilista. */
const CATEGORY_ACCOUNT: Record<string, string> = {
  Internet:   "6262",
  Energia:    "6241",
  "Água":     "6242",
  Limpeza:    "6226",
  "Manutenção": "6223",
  "Salários": "6311",
  Marketing:  "6252",
  Outros:     "6298",
};
const DEFAULT_ACCOUNT = "6298";

export const LEGACY_MARKER = (id: string) => `LEGACY_EXPENSE:${id}`;

async function categoryIdFor(name: string): Promise<string> {
  const existing = await prisma.expenseCategory.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.expenseCategory.create({
    data: { name, accountCode: CATEGORY_ACCOUNT[name] ?? DEFAULT_ACCOUNT, description: "Criada pela ponte Despesas CRM → ERP" },
  });
  return created.id;
}

export type BridgeResult =
  | { ok: true; erpExpenseId: string; already?: boolean }
  | { ok: false; error: string };

/** Regista no ERP o pagamento de uma despesa CRM já PAGA. Nunca lança. */
export async function syncExpenseToErp(expenseId: string, actorId: string): Promise<BridgeResult> {
  try {
    const legacy = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!legacy) return { ok: false, error: "Despesa não encontrada." };
    if (legacy.status !== "PAGO") return { ok: false, error: "Só despesas PAGO são sincronizadas com o ERP." };
    if (legacy.erpExpenseId) return { ok: true, erpExpenseId: legacy.erpExpenseId, already: true };

    const paidAt = legacy.paidDate ?? legacy.expenseDate;
    const marker = LEGACY_MARKER(legacy.id);

    // Recuperação: ERP já criado numa tentativa anterior que falhou a meio.
    let erp = await prisma.erpExpense.findFirst({ where: { notes: { contains: marker } } });
    if (!erp) {
      const categoryId = await categoryIdFor(legacy.category);
      const now = new Date();
      erp = await prisma.erpExpense.create({
        data: {
          categoryId,
          supplierName: legacy.supplier ?? undefined,
          description:  legacy.description,
          amount:       Math.round(legacy.amount),
          dueDate:      legacy.expenseDate,
          status:       ErpExpenseStatus.APPROVED,
          approvedBy:   "SYSTEM",
          approvedAt:   now,
          receiptUrl:   legacy.receiptUrl ?? undefined,
          notes:        [legacy.notes, marker].filter(Boolean).join("\n"),
          createdBy:    actorId,
        },
      });
    }

    if (erp.status !== ErpExpenseStatus.PAID) {
      try {
        await payErpExpense(erp.id, { paidAt }, actorId);
      } catch (err) {
        // Sem lançamentos → seguro apagar o registo ERP órfão para nova tentativa limpa.
        const entries = await prisma.financialLedger.count({ where: { expenseId: erp.id } });
        if (entries === 0) await prisma.erpExpense.delete({ where: { id: erp.id } }).catch(() => {});
        throw err;
      }
      recalculateBalances(undefined, paidAt).catch(() => {});
    }

    await prisma.expense.update({ where: { id: legacy.id }, data: { erpExpenseId: erp.id } });
    return { ok: true, erpExpenseId: erp.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[expense-erp-bridge]", err);
    return { ok: false, error: msg };
  }
}
