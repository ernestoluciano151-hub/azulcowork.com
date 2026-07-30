import { NextRequest, NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth";
import { recordAudit, actorFromSession, UNKNOWN_ACTOR } from "@/lib/audit-service";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Capturar sessão antes de destruir (para auditoria)
  const session = await getSession();

  await destroySession();

  // Audit: LOGOUT — post-commit
  recordAudit({
    actor:     session ? actorFromSession(session) : UNKNOWN_ACTOR,
    action:    "LOGOUT",
    entity:    "AdminUser",
    entityId:  session?.sub ?? "UNKNOWN",
    entityRef: session?.email ?? undefined,
    ipAddress: ip,
  }).catch(err => console.error("[Audit] LOGOUT:", err));

  return NextResponse.json({ ok: true });
}
