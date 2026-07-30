/**
 * POST /api/erp/expenses/[id]/approve
 * Aprova despesa PENDING → APPROVED. Requer ADMIN.
 * Necessário quando amount > Kz 50.000 (BR-FIN-008).
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { approveErpExpense }          from "@/lib/erp-expense-service";
import "@/lib/bootstrap";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { id } = await params;

  try {
    const expense = await approveErpExpense(id, session!.sub);
    return NextResponse.json(expense);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao aprovar despesa.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
