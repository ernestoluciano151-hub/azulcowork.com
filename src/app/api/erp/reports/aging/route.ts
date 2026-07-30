/**
 * GET /api/erp/reports/aging
 * Relatório de Aging de Contas a Receber (AR).
 *
 * Query params:
 *   companyId  — filtrar por empresa (opcional)
 *   asOf       — data de referência ISO (default: hoje)
 *   view       — "lines" | "buckets" | "both" (default: "both")
 *
 * Resposta:
 *  {
 *    asOf:             string (ISO),
 *    totalOutstanding: number (AOA),
 *    buckets: [{ bucket, label, count, outstanding }],
 *    lines:   [{ companyId, companyName, nif, invoiceNumber, status,
 *                dueDate, daysOverdue, bucket, total, paid, outstanding }]
 *  }
 *
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/billing.md#aging · docs/roadmap/erp-roadmap.md#erp-4
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { getArAging }                 from "@/lib/erp-receivables-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const companyId = searchParams.get("companyId") ?? undefined;
  const view      = searchParams.get("view") ?? "both";

  let asOf: Date | undefined;
  const asOfParam = searchParams.get("asOf");
  if (asOfParam) {
    const d = new Date(asOfParam);
    if (isNaN(d.getTime()))
      return NextResponse.json({ error: "asOf inválida." }, { status: 422 });
    asOf = d;
  }

  try {
    const report = await getArAging({ companyId, asOf });

    const body: Record<string, unknown> = {
      asOf:             report.asOf.toISOString(),
      totalOutstanding: report.totalOutstanding,
    };

    if (view === "buckets" || view === "both") body.buckets = report.buckets;
    if (view === "lines"   || view === "both") body.lines   = report.lines;

    return NextResponse.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar relatório AR.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
