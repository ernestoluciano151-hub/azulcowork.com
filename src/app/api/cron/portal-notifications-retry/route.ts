/**
 * GET /api/cron/portal-notifications-retry
 *
 * Processa notificações PENDING prontas para re-tentativa.
 * Schedule: a cada 5 minutos  (cron: 0,5,10,15,20,25,30,35,40,45,50,55 * * * *)
 * Segurança: Authorization: Bearer ${CRON_SECRET}
 *
 * Fluxo:
 *   1. Busca notificações PENDING com nextRetryAt ≤ now()
 *   2. Despacha cada uma pelo canal (EMAIL, WHATSAPP, IN_APP, PUSH_WEB)
 *   3. Em falha: incrementa attempts + agenda nextRetryAt (backoff)
 *   4. Após 3 falhas: status → FAILED (definitivo)
 *
 * Limite: 50 notificações por ciclo (evitar timeout de 10s do Vercel)
 */

import { NextRequest, NextResponse }        from "next/server";
import { processPendingNotifications }       from "@/lib/portal-omnichannel-service";

function verifyCronSecret(req: NextRequest): boolean {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const { processed, failed } = await processPendingNotifications();

    return NextResponse.json({
      ok:         true,
      processed,
      failed,
      durationMs: Date.now() - startedAt,
      timestamp:  new Date().toISOString(),
    });
  } catch (err) {
    console.error("[CRON portal-notifications-retry]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" },
      { status: 500 }
    );
  }
}
