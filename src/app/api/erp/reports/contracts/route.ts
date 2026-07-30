/**
 * GET /api/erp/reports/contracts
 * Resumo de contratos por estado + a expirar nos próximos 90 dias (R-10).
 *
 * Requer ADMIN | FINANCEIRO | VIEWER.
 *
 * Docs: docs/05-erp/reports.md#r-10
 */

import { NextRequest, NextResponse }  from "next/server";
import { requireSession }             from "@/lib/auth";
import { getContractsSummary }        from "@/lib/erp-dashboard-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireSession(req);
  if (error) return error;

  try {
    const summary = await getContractsSummary();
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar relatório de contratos.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
