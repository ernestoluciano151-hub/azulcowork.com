/**
 * GET /api/cron/portal-contract-expiring
 *
 * Alertas de contratos a expirar em 30, 15 e 7 dias.
 * Schedule: 0 8 * * * (diário às 08h WAT = 07h UTC)
 * Segurança: Authorization: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse }   from "next/server";
import { checkContractExpiring }        from "@/lib/portal-alerts-service";

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
    const { alerts } = await checkContractExpiring();
    return NextResponse.json({ ok: true, alerts, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[CRON portal-contract-expiring]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" },
      { status: 500 }
    );
  }
}
