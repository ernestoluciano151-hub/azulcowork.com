import { NextRequest, NextResponse } from "next/server";
import { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { recordAudit, actorFromSession } from "@/lib/audit-service";

const VALID_ROLES: AdminRole[] = [AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO, AdminRole.VIEWER];

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { name, email, role, active, newPassword } = await req.json();
  const updateData: { name?: string; email?: string; role?: AdminRole; active?: boolean; passwordHash?: string } = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email.toLowerCase();
  if (role !== undefined) updateData.role = VALID_ROLES.includes(role) ? (role as AdminRole) : AdminRole.VIEWER;
  if (active !== undefined) updateData.active = active;
  const passwordChanged = !!newPassword;
  if (newPassword) {
    updateData.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  // Capturar estado anterior para auditoria
  const before = await prisma.adminUser.findUnique({
    where: { id: params.id },
    select: { email: true, name: true, role: true, active: true },
  });

  const user = await prisma.adminUser.update({
    where: { id: params.id },
    data: updateData,
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });

  // Determinar qual a acção de auditoria mais específica
  const auditAction =
    passwordChanged
      ? "ADMIN_PASSWORD_CHANGED"
      : active === false
      ? "ADMIN_USER_DEACTIVATED"
      : active === true
      ? "ADMIN_USER_REACTIVATED"
      : "ADMIN_USER_UPDATED";

  recordAudit({
    actor:     actorFromSession(session),
    action:    auditAction,
    entity:    "AdminUser",
    entityId:  user.id,
    entityRef: user.email,
    ipAddress: ip,
    before:    before ?? undefined,
    after:     passwordChanged
                 ? { id: user.id, email: user.email }  // não registar before/after de password
                 : { email: user.email, name: user.name, role: user.role, active: user.active },
  }).catch(err => console.error(`[Audit] ${auditAction}:`, err));

  return NextResponse.json({ user });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  if (session.sub === params.id) {
    return NextResponse.json({ error: "Não pode eliminar a sua própria conta." }, { status: 400 });
  }

  // Capturar dados antes de eliminar (para auditoria)
  const target = await prisma.adminUser.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, name: true, role: true },
  });

  await prisma.adminUser.delete({ where: { id: params.id } });

  recordAudit({
    actor:    actorFromSession(session),
    action:   "ADMIN_USER_DELETED",
    entity:   "AdminUser",
    entityId: params.id,
    entityRef: target?.email,
    ipAddress: ip,
    before:   target ?? undefined,
  }).catch(err => console.error("[Audit] ADMIN_USER_DELETED:", err));

  return NextResponse.json({ ok: true });
}
