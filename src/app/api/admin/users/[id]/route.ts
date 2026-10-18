import { NextRequest, NextResponse } from "next/server";
import { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner";
import bcrypt from "bcryptjs";
import * as Sentry from "@sentry/nextjs";
import { recordAudit, actorFromSession } from "@/lib/audit-service";

const VALID_ROLES: AdminRole[] = [AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO, AdminRole.VIEWER];

export const dynamic = "force-dynamic";

/** Revoga as sessões do utilizador para que o novo papel/estado/senha tenha efeito de imediato. */
async function revokeSessions(userId: string) {
  await prisma.adminSession.updateMany({ where: { adminUserId: userId }, data: { isRevoked: true } });
}

/**
 * PATCH — SÓ o proprietário (Ernesto): atribuir papel, activar/desactivar, editar dados, repor senha.
 * A conta do proprietário não pode ser despromovida nem desactivada.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { session, error } = await requireOwner();
  if (error) return error;

  try {
    const { name, email, role, active, newPassword } = await req.json();

    const before = await prisma.adminUser.findUnique({
      where: { id: params.id },
      select: { email: true, name: true, role: true, active: true },
    });
    if (!before) return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });

    const targetIsOwner = isOwnerEmail(before.email);
    if (targetIsOwner && (role !== undefined && role !== "ADMIN" || active === false || (email !== undefined && !isOwnerEmail(email)))) {
      return NextResponse.json({ error: "A conta do proprietário não pode ser despromovida, desactivada ou renomeada." }, { status: 400 });
    }
    if (newPassword !== undefined && String(newPassword).length < 8) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });
    }

    const updateData: { name?: string; email?: string; role?: AdminRole; active?: boolean; passwordHash?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = String(email).toLowerCase();
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
      updateData.role = role as AdminRole;
    }
    if (active !== undefined) updateData.active = !!active;
    const passwordChanged = !!newPassword;
    if (newPassword) updateData.passwordHash = await bcrypt.hash(newPassword, 12);

    const user = await prisma.adminUser.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });

    // Papel alterado / desactivado / senha reposta → sessões antigas deixam de valer
    const mustRevoke = passwordChanged || active === false || (role !== undefined && role !== before.role);
    if (mustRevoke && !targetIsOwner) await revokeSessions(user.id);

    const auditAction =
      passwordChanged ? "ADMIN_PASSWORD_CHANGED"
      : active === false ? "ADMIN_USER_DEACTIVATED"
      : active === true ? "ADMIN_USER_REACTIVATED"
      : "ADMIN_USER_UPDATED";

    recordAudit({
      actor:     actorFromSession(session),
      action:    auditAction,
      entity:    "AdminUser",
      entityId:  user.id,
      entityRef: user.email,
      ipAddress: ip,
      before,
      after:     passwordChanged
                   ? { id: user.id, email: user.email }
                   : { email: user.email, name: user.name, role: user.role, active: user.active },
    }).catch(err => console.error(`[Audit] ${auditAction}:`, err));

    return NextResponse.json({ user });
  } catch (err) {
    console.error("[PATCH /api/admin/users/:id]", err);
    Sentry.captureException(err, { tags: { route: "admin/users/[id]" } });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao actualizar utilizador: ${msg}` }, { status: 500 });
  }
}

/** DELETE — SÓ o proprietário. Não elimina a própria conta nem a do proprietário. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { session, error } = await requireOwner();
  if (error) return error;

  try {
    if (session.sub === params.id) {
      return NextResponse.json({ error: "Não pode eliminar a sua própria conta." }, { status: 400 });
    }
    const target = await prisma.adminUser.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!target) return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });
    if (isOwnerEmail(target.email)) {
      return NextResponse.json({ error: "A conta do proprietário não pode ser eliminada." }, { status: 400 });
    }

    // Sessões têm onDelete: Cascade; empresas atribuídas passam a "sem responsável" (SetNull).
    await prisma.adminUser.delete({ where: { id: params.id } });

    recordAudit({
      actor:    actorFromSession(session),
      action:   "ADMIN_USER_DELETED",
      entity:   "AdminUser",
      entityId: params.id,
      entityRef: target.email,
      ipAddress: ip,
      before:   target,
    }).catch(err => console.error("[Audit] ADMIN_USER_DELETED:", err));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/users/:id]", err);
    Sentry.captureException(err, { tags: { route: "admin/users/[id]" } });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao eliminar utilizador: ${msg}` }, { status: 500 });
  }
}
