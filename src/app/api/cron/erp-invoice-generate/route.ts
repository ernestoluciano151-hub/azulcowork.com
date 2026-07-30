/**
 * GET /api/cron/erp-invoice-generate
 *
 * Cron de faturação mensal automática — gera faturas de renda para todos os
 * ErpRentSchedule com status=PENDING e dueDate ≤ hoje.
 *
 * Execução: 1.º dia de cada mês às 07:00 Africa/Luanda (UTC 06:00).
 *
 * Segurança: requer header Authorization: Bearer ${CRON_SECRET}
 *
 * Configuração Vercel (vercel.json):
 *  { "crons": [{ "path": "/api/cron/erp-invoice-generate", "schedule": "0 6 1 * *" }] }
 *
 * Resultado:
 *  - generated: fatura criada + emitida (fire-and-forget) + email enviado
 *  - skipped:   schedule já tinha invoiceId (idempotência)
 *  - error:     falha isolada — não impede os restantes schedules
 *
 * Docs: docs/13-automacoes/README.md
 */

import { NextRequest, NextResponse } from "next/server";
import { generateMonthlyInvoices }   from "@/lib/erp-invoice-generate-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  // ── Autenticação via CRON_SECRET ───────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const results = await generateMonthlyInvoices();

    const generated = results.filter(r => r.status === "generated").length;
    const skipped   = results.filter(r => r.status === "skipped").length;
    const errors    = results.filter(r => r.status === "error").length;

    const durationMs = Date.now() - startedAt;

    console.log(
      `[Cron erp-invoice-generate] Concluído em ${durationMs}ms — ` +
      `geradas: ${generated}, ignoradas: ${skipped}, erros: ${errors}`
    );

    return NextResponse.json({
      ok: true,
      summary: { generated, skipped, errors, total: results.length, durationMs },
      results,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Cron erp-invoice-generate] Erro crítico:", err);
    return NextResponse.json(
      { ok: false, error: message, durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
