/**
 * GET /api/erp/cashflow/projection
 * Projecção de cashflow para 30 / 60 / 90 dias.
 * Combina movimentos reais futuros + RentSchedules PENDING + Expenses recorrentes APPROVED.
 *
 * Query params:
 *   horizonDays — 30 | 60 | 90 (default: 90)
 *   bankAccount — conta bancária (default: BCS-MAIN)
 *
 * Resposta:
 *  [{ date, type, amount, description, isProjected, runningBalance }]
 *
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/cashflow.md#4-projecção-de-fluxo-de-caixa
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { getCashflowProjection }      from "@/lib/erp-cashflow-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = req.nextUrl;

  const horizonRaw = parseInt(searchParams.get("horizonDays") ?? "90", 10);
  const horizonDays = [30, 60, 90].includes(horizonRaw) ? horizonRaw : 90;

  try {
    const projection = await getCashflowProjection({
      horizonDays,
      bankAccount: searchParams.get("bankAccount") ?? undefined,
    });
    return NextResponse.json({ horizonDays, entries: projection });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar projecção de caixa.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
