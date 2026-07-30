/**
 * GET /api/cron/portal-payment-overdue
 *
 * Alertas de pagamento em atraso (+1 dia, +7 dias, +30 dias).
 * Schedule: 0 9 * * * (diário às 09h WAT = 08h UTC)
 * Segurança: Authorization: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse }  from "next/server";
import { checkPaymentOverdue }         from "@/lib/portal-alerts-service";

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

  try {
    const { alerts } = await checkPaymentOverdue();
    return NextResponse.json({ ok: true, alerts, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[CRON portal-payment-overdue]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" },
      { status: 500 }
    );
  }
}
