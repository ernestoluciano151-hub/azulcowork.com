/**
 * GET /api/erp/reports/ap
 * Relatório de Contas a Pagar (AP — Accounts Payable).
 *
 * Query params:
 *   categoryId   — filtrar por categoria (opcional)
 *   costCenterId — filtrar por centro de custo (opcional)
 *   asOf         — data de referência ISO (default: hoje)
 *
 * Resposta:
 *  {
 *    asOf:          string (ISO),
 *    totalPending:  number (AOA — despesas aguardam aprovação),
 *    totalApproved: number (AOA — aprovadas, prontas a pagar),
 *    totalOverdue:  number (AOA — aprovadas e em atraso),
 *    lines: [{
 *      expenseId, description, categoryName, accountCode,
 *      supplierName, costCenterCode, dueDate, daysOverdue, amount, status
 *    }]
 *  }
 *
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/expenses.md · docs/roadmap/erp-roadmap.md#erp-4
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { getApReport }                from "@/lib/erp-receivables-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = req.nextUrl;

  let asOf: Date | undefined;
  const asOfParam = searchParams.get("asOf");
  if (asOfParam) {
    const d = new Date(asOfParam);
    if (isNaN(d.getTime()))
      return NextResponse.json({ error: "asOf inválida." }, { status: 422 });
    asOf = d;
  }

  try {
    const report = await getApReport({
      categoryId:   searchParams.get("categoryId")   ?? undefined,
      costCenterId: searchParams.get("costCenterId") ?? undefined,
      asOf,
    });

    return NextResponse.json({
      asOf:          report.asOf.toISOString(),
      totalPending:  report.totalPending,
      totalApproved: report.totalApproved,
      totalOverdue:  report.totalOverdue,
      lines:         report.lines,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar relatório AP.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
