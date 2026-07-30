/**
 * GET /api/erp/reports/pnl
 * Demonstração de Resultados — P&L (R-02).
 *
 * Query params:
 *   period — "YYYY-MM" (default: mês corrente)
 *
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/reports.md#r-02
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { getPnl, getTrialBalance }    from "@/lib/erp-dashboard-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const period    = searchParams.get("period") ?? undefined;
  const view      = searchParams.get("view") ?? "pnl"; // "pnl" | "trial" | "both"

  try {
    const result: Record<string, unknown> = {};

    if (view === "pnl" || view === "both") {
      result.pnl = await getPnl(period);
    }
    if (view === "trial" || view === "both") {
      result.trialBalance = await getTrialBalance(period);
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar P&L.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
