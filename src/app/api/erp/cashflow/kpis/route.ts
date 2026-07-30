/**
 * GET /api/erp/cashflow/kpis
 * KPIs de tesouraria para o dashboard financeiro.
 *
 * Resposta:
 *  {
 *    currentBalance:      number,  — saldo actual (AOA)
 *    projectedBalance30:  number,  — saldo projectado em 30 dias
 *    projectedBalance90:  number,  — saldo projectado em 90 dias
 *    inflowCurrentMonth:  number,
 *    outflowCurrentMonth: number,
 *    netCurrentMonth:     number,
 *    burnRate3m:          number,  — média mensal de saídas (últimos 3 meses)
 *    runway:              number,  — meses de operação (floor)
 *    mrr:                 number,  — Monthly Recurring Revenue
 *  }
 *
 * Query params:
 *   bankAccount — conta bancária (default: BCS-MAIN)
 *
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/cashflow.md#8-kpis-de-cash-flow-no-dashboard
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { getCashflowKpis }            from "@/lib/erp-cashflow-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = req.nextUrl;

  try {
    const kpis = await getCashflowKpis(searchParams.get("bankAccount") ?? undefined);
    return NextResponse.json(kpis);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao calcular KPIs de caixa.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
