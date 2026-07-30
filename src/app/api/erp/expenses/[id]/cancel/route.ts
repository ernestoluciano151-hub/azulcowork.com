/**
 * POST /api/erp/expenses/[id]/cancel
 * Cancela despesa PENDING | APPROVED → CANCELLED.
 * Requer ADMIN | FINANCEIRO.
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { cancelErpExpense }           from "@/lib/erp-expense-service";
import "@/lib/bootstrap";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { id } = await params;

  try {
    const expense = await cancelErpExpense(id, session!.sub);
    return NextResponse.json(expense);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao cancelar despesa.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
