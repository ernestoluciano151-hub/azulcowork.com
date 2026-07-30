/**
 * GET /api/erp/reports/mrr
 * MRR Breakdown — evolução mês a mês (R-07).
 *
 * Query params:
 *   months — número de meses a analisar (1–24, default: 6)
 *
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/reports.md#r-07
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { getMrrBreakdown }            from "@/lib/erp-dashboard-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const monthsParam = parseInt(searchParams.get("months") ?? "6", 10);
  const months = Math.min(24, Math.max(1, isNaN(monthsParam) ? 6 : monthsParam));

  try {
    const breakdown = await getMrrBreakdown(months);
    return NextResponse.json({ months, breakdown });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar MRR breakdown.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
