/**
 * GET /api/erp/reports/reconciliation
 * R-05: Reconciliação bancária (CashMovement vs Payments/Expenses).
 *
 * Query params:
 *   period      — "YYYY-MM" (default: mês corrente)
 *   bankAccount — conta bancária (default: "BCS-MAIN")
 *
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/reports.md#r-05
 */

import { NextRequest, NextResponse }      from "next/server";
import { AdminRole }                      from "@prisma/client";
import { requireRole }                    from "@/lib/auth";
import { getReconciliationReport }        from "@/lib/erp-reconciliation-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const period      = searchParams.get("period")      ?? undefined;
  const bankAccount = searchParams.get("bankAccount") ?? "BCS-MAIN";

  try {
    const data = await getReconciliationReport(period, bankAccount);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar relatório de reconciliação.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
