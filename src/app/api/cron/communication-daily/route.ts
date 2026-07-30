/**
 * GET /api/cron/communication-daily
 *
 * Cron job diário de comunicação — executado às 08:00 Africa/Luanda.
 *
 * Sequência:
 *  1. retryFailedEmails — retenta até 50 emails FAILED (máx. 3 tentativas)
 *
 * Segurança: requer header Authorization: Bearer ${CRON_SECRET}
 *
 * Configuração Vercel (vercel.json):
 *  { "crons": [{ "path": "/api/cron/communication-daily", "schedule": "0 7 * * *" }] }
 *  (UTC 07:00 = Africa/Luanda 08:00)
 *
 * VOL07 — Sprint VOL07-3
 */

import { NextRequest, NextResponse } from "next/server";
import { retryFailedEmails } from "@/lib/communication-service";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const started = Date.now();
  const result: Record<string, unknown> = {};

  // 1. Retry de emails falhados
  try {
    const retry = await retryFailedEmails(3);
    result.emailRetry = retry;
    console.log("[cron/comm] Email retry:", retry);
  } catch (err) {
    result.emailRetryError = err instanceof Error ? err.message : String(err);
    console.error("[cron/comm] Erro no email retry:", err);
  }

  const elapsed = Date.now() - started;
  console.log(`[cron/comm] communication-daily concluído em ${elapsed}ms`);

  return NextResponse.json({
    ok:      true,
    elapsed: `${elapsed}ms`,
    result,
  });
}
