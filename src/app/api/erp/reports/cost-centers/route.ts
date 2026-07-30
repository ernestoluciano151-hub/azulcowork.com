/**
 * GET /api/erp/reports/cost-centers
 * Relatório de despesas real vs. orçado por centro de custo (R-09).
 *
 * Query params:
 *   period — "YYYY-MM" (default: mês corrente)
 *
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/reports.md#r-09
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { getCostCenterReport }        from "@/lib/erp-dashboard-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") ?? undefined;

  try {
    const report = await getCostCenterReport(period);
    return NextResponse.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar relatório de centros de custo.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
