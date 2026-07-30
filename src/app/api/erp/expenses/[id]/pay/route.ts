/**
 * POST /api/erp/expenses/[id]/pay
 * Marca despesa APPROVED → PAID.
 * Gera: FinancialLedger (partida dupla) + CashMovement OUTFLOW + TimelineEntry.
 * IVA dedutível se supplierNif presente (DEBIT 2312).
 * Requer ADMIN | FINANCEIRO.
 *
 * Body: { paidAt: string (ISO), receiptUrl?: string, notes?: string }
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { payErpExpense }              from "@/lib/erp-expense-service";
import "@/lib/bootstrap";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* paidAt required mas tratamos abaixo */ }

  const paidAtRaw = body.paidAt ?? new Date().toISOString();
  if (isNaN(Date.parse(String(paidAtRaw))))
    return NextResponse.json({ error: "paidAt inválida." }, { status: 422 });

  try {
    const expense = await payErpExpense(
      id,
      {
        paidAt:     new Date(String(paidAtRaw)),
        receiptUrl: typeof body.receiptUrl === "string" ? body.receiptUrl : undefined,
        notes:      typeof body.notes      === "string" ? body.notes      : undefined,
      },
      session!.sub
    );
    return NextResponse.json(expense);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao registar pagamento de despesa.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
