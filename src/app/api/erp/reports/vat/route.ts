/**
 * GET /api/erp/reports/vat
 * R-07: Relatório de apuramento de IVA mensal.
 *
 * Query params:
 *   period  — "YYYY-MM" (default: mês corrente)
 *   history — true → retorna histórico N meses (default: false)
 *   months  — número de meses para histórico (default: 6, max: 24)
 *
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/reports.md#r-07
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { getVatReport, getVatHistory } from "@/lib/erp-vat-report-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const period  = searchParams.get("period")  ?? undefined;
  const history = searchParams.get("history") === "true";
  const months  = Math.min(parseInt(searchParams.get("months") || "6"), 24);

  try {
    if (history) {
      const data = await getVatHistory(months);
      return NextResponse.json(data);
    }
    const data = await getVatReport(period);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar relatório de IVA.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
