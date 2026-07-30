import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { recordAudit, actorFromSession } from "@/lib/audit-service";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/sessions/[id]
 *
 * Revoga uma sessão específica do utilizador autenticado.
 * Um utilizador só pode revogar as suas próprias sessões.
 * ADMIN não pode revogar sessões de outros utilizadores por esta rota
 * (funcionalidade reservada para o painel de segurança em VOL05-3).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { session, error } = await requireSession();
  if (error) return error;

  // Verificar que a sessão pertence ao utilizador autenticado
  const target = await prisma.adminSession.findUnique({
    where: { id: params.id },
    select: { id: true, adminUserId: true, isRevoked: true, expiresAt: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  }

  if (target.adminUserId !== session.sub) {
    return NextResponse.json({ error: "Sem permissão para revogar esta sessão." }, { status: 403 });
  }

  if (target.isRevoked) {
    return NextResponse.json({ error: "Sessão já revogada." }, { status: 400 });
  }

  await prisma.adminSession.update({
    where: { id: params.id },
    data:  { isRevoked: true },
  });

  recordAudit({
    actor:     actorFromSession(session),
    action:    "SESSION_REVOKED",
    entity:    "AdminSession",
    entityId:  params.id,
    ipAddress: ip,
    metadata:  { revokedBy: "USER_SELF" },
  }).catch(err => console.error("[Audit] SESSION_REVOKED:", err));

  return NextResponse.json({ ok: true });
}
