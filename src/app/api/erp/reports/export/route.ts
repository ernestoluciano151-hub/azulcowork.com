/**
 * GET /api/erp/reports/export
 * Exportação de relatórios financeiros em XLSX ou CSV.
 *
 * Query params:
 *   type    — "pnl" | "aging" | "mrr" | "vat" | "cost-centers" | "delinquency"
 *   format  — "xlsx" (default) | "csv"
 *   period  — "YYYY-MM" (irrelevante para alguns tipos)
 *   months  — número de meses para tendência MRR (default: 6, max: 24)
 *
 * Requer ADMIN | FINANCEIRO.
 * Devolve resposta binária com Content-Disposition para download.
 *
 * Docs: docs/05-erp/reports.md#export
 */

import { NextRequest }   from "next/server";
import { AdminRole }     from "@prisma/client";
import { requireRole }   from "@/lib/auth";
import {
  exportPnl,
  exportAgingAr,
  exportMrrBreakdown,
  exportVatReport,
  exportCostCenters,
  exportDelinquency,
  ExportFormat,
} from "@/lib/erp-export-service";
import "@/lib/bootstrap";

const ALLOWED_TYPES = ["pnl", "aging", "mrr", "vat", "cost-centers", "delinquency"] as const;
type ReportType = typeof ALLOWED_TYPES[number];

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const type   = searchParams.get("type") as ReportType | null;
  const format = (searchParams.get("format") ?? "xlsx") as ExportFormat;
  const period = searchParams.get("period") ?? undefined;
  const months = Math.min(parseInt(searchParams.get("months") || "6"), 24);

  // Validar parâmetros
  if (!type || !ALLOWED_TYPES.includes(type)) {
    return new Response(
      JSON.stringify({ error: `Tipo inválido. Usar: ${ALLOWED_TYPES.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (format !== "xlsx" && format !== "csv") {
    return new Response(
      JSON.stringify({ error: 'Formato inválido. Usar "xlsx" ou "csv".' }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    let result;
    switch (type) {
      case "pnl":
        result = await exportPnl(period, format);
        break;
      case "aging":
        result = await exportAgingAr({ period }, format);
        break;
      case "mrr":
        result = await exportMrrBreakdown(months, format);
        break;
      case "vat":
        result = await exportVatReport(period, format);
        break;
      case "cost-centers":
        result = await exportCostCenters(period, format);
        break;
      case "delinquency":
        result = await exportDelinquency(format);
        break;
    }

    return new Response(result.buffer, {
      status: 200,
      headers: {
        "Content-Type":        result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao exportar relatório.";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
