/**
 * GET /api/erp/dashboard
 * KPIs do dashboard financeiro em tempo real (R-01).
 *
 * Resposta: DashboardKpis
 *  { mrr, arr, revenueCurrentMonth, receivedCurrentMonth, totalOutstanding,
 *    overdueAmount, delinquencyRate, activeContracts, churnRate, averageTicket,
 *    expensesCurrentMonth, operatingProfit, currentBalance, projectedBalance90,
 *    activeAlerts, criticalAlerts }
 *
 * Requer ADMIN | FINANCEIRO | VIEWER (VIEWER vê KPIs sem dados sensíveis — tratado no FE).
 *
 * Docs: docs/05-erp/reports.md#r-01
 */

import { NextRequest, NextResponse }  from "next/server";
import { requireSession }             from "@/lib/auth";
import { getDashboardKpis }           from "@/lib/erp-dashboard-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireSession(req);
  if (error) return error;

  try {
    const kpis = await getDashboardKpis();
    return NextResponse.json(kpis);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao calcular KPIs do dashboard.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
