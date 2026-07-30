/**
 * GET /api/erp/reports/delinquency
 * Relatório de inadimplência (R-08).
 * Empresas com faturas em atraso, valor em aberto, dias do mais antigo.
 *
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/reports.md#r-08
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { getDelinquencyReport }       from "@/lib/erp-dashboard-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  try {
    const report = await getDelinquencyReport();
    return NextResponse.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar relatório de inadimplência.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
