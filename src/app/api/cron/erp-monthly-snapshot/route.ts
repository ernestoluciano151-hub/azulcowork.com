/**
 * GET /api/cron/erp-monthly-snapshot
 * Cron job de fecho mensal — gera FinancialReportSnapshot.
 * Executar no último dia do mês às 23:00 Africa/Luanda (UTC 22:00).
 *
 * Configuração Vercel (vercel.json):
 *  { "crons": [{ "path": "/api/cron/erp-monthly-snapshot", "schedule": "0 22 28-31 * *" }] }
 *  (executa nos dias 28–31 — o sistema trata idempotentemente o período do mês anterior)
 *
 * Segurança: requer header Authorization: Bearer ${CRON_SECRET}
 *
 * Docs: docs/05-erp/reports.md#3-financialreportsnapshot
 */

import { NextRequest, NextResponse }     from "next/server";
import { generateMonthlySnapshot }       from "@/lib/erp-dashboard-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  // period opcional: "YYYY-MM" — por defeito gera snapshot do mês anterior
  const period = searchParams.get("period") ?? undefined;

  try {
    const snapshot = await generateMonthlySnapshot(period);
    console.log("[CRON erp-monthly-snapshot] Snapshot gerado:", snapshot.period);
    return NextResponse.json({
      ok:     true,
      period: snapshot.period,
      type:   snapshot.type,
      generatedAt: snapshot.generatedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar snapshot mensal.";
    console.error("[CRON erp-monthly-snapshot]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
