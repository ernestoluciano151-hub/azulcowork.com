/**
 * POST /api/erp/expenses/[id]/reject
 * Rejeita despesa PENDING → REJECTED. Requer ADMIN.
 * Body: { reason?: string }
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { rejectErpExpense }           from "@/lib/erp-expense-service";
import "@/lib/bootstrap";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { id } = await params;

  let reason = "Despesa rejeitada";
  try {
    const body = await req.json();
    if (typeof body.reason === "string" && body.reason.trim()) reason = body.reason.trim();
  } catch { /* sem corpo é válido */ }

  try {
    const expense = await rejectErpExpense(id, reason, session!.sub);
    return NextResponse.json(expense);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao rejeitar despesa.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
