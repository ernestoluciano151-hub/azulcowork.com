/**
 * GET    /api/admin/portal/users/[id]
 * PATCH  /api/admin/portal/users/[id]
 * DELETE /api/admin/portal/users/[id]
 *
 * Gestão individual de um PortalUser (admin).
 *
 * GET    — detalhe completo: sessões activas, notificações, tickets, logins recentes.
 * PATCH  — activar/desactivar conta, alterar nome, alterar role (com restrições).
 * DELETE — desactiva a conta + revoga todas as sessões activas.
 *           Nunca apaga fisicamente (auditoria).
 *
 * Restrições PATCH:
 *   - PORTAL_OWNER não pode ter o role alterado via admin (usar transfer-ownership no portal)
 *   - Não é possível desactivar o último PORTAL_OWNER activo de uma empresa
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole, PortalRole }     from "@prisma/client";
import { prisma }                     from "@/lib/prisma";
import { requireRole }                from "@/lib/auth";
import { revokeAllPortalSessions }    from "@/lib/portal-auth-service";
import { z }                          from "zod";

const patchSchema = z.object({
  name:     z.string().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
  role:     z.enum([
    PortalRole.PORTAL_VIEWER,
    PortalRole.PORTAL_MEMBER,
    PortalRole.PORTAL_ADMIN,
  ]).optional(), // PORTAL_OWNER excluído — só via transfer-ownership
}).refine(
  data => Object.keys(data).length > 0,
  { message: "Nenhum campo para actualizar." }
);

// ── GET — detalhe ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { id } = await params;
  const now    = new Date();

  const user = await prisma.portalUser.findUnique({
    where:  { id },
    select: {
      id:          true,
      name:        true,
      email:       true,
      role:        true,
      isActive:    true,
      isConfirmed: true,
      lastLoginAt: true,
      createdAt:   true,
      updatedAt:   true,
      company:     { select: { id: true, name: true } },
      sessions: {
        where:   { isRevoked: false, expiresAt: { gt: now } },
        select:  { id: true, createdAt: true, ipAddress: true, userAgent: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
        take:    5,
      },
      _count: {
        select: {
          notifications: true,
          ticketsCreated: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ user });
}

// ── PATCH — actualizar ────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { id } = await params;

  const user = await prisma.portalUser.findUnique({
    where:  { id },
    select: { id: true, role: true, isActive: true, companyId: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const { name, isActive, role } = parsed.data;

  // Bloquear alteração de role do PORTAL_OWNER via admin
  if (role !== undefined && user.role === PortalRole.PORTAL_OWNER) {
    return NextResponse.json(
      {
        error: "O role PORTAL_OWNER não pode ser alterado via painel admin. "
          + "Use a funcionalidade de transferência de ownership no portal do cliente.",
      },
      { status: 422 }
    );
  }

  // Bloquear desactivação do último PORTAL_OWNER activo da empresa
  if (isActive === false && user.role === PortalRole.PORTAL_OWNER) {
    const otherOwners = await prisma.portalUser.count({
      where: {
        companyId: user.companyId,
        role:      PortalRole.PORTAL_OWNER,
        isActive:  true,
        id:        { not: user.id },
      },
    });
    if (otherOwners === 0) {
      return NextResponse.json(
        {
          error: "Não é possível desactivar o único PORTAL_OWNER activo da empresa. "
            + "Transfira o ownership primeiro.",
        },
        { status: 422 }
      );
    }
  }

  const updated = await prisma.portalUser.update({
    where: { id },
    data:  {
      ...(name     !== undefined ? { name }     : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(role     !== undefined ? { role }     : {}),
    },
    select: {
      id:       true,
      name:     true,
      email:    true,
      role:     true,
      isActive: true,
    },
  });

  // Se desactivado, revogar todas as sessões
  if (isActive === false) {
    await revokeAllPortalSessions(id);
  }

  return NextResponse.json({ ok: true, user: updated });
}

// ── DELETE — desactivar + revogar sessões ─────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { id } = await params;

  const user = await prisma.portalUser.findUnique({
    where:  { id },
    select: { id: true, role: true, companyId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });
  }

  // Verificar que não é o último PORTAL_OWNER activo
  if (user.role === PortalRole.PORTAL_OWNER) {
    const otherOwners = await prisma.portalUser.count({
      where: {
        companyId: user.companyId,
        role:      PortalRole.PORTAL_OWNER,
        isActive:  true,
        id:        { not: user.id },
      },
    });
    if (otherOwners === 0) {
      return NextResponse.json(
        {
          error: "Não é possível eliminar o único PORTAL_OWNER activo da empresa. "
            + "Transfira o ownership primeiro.",
        },
        { status: 422 }
      );
    }
  }

  // Desactivar (nunca apagar fisicamente — auditoria) + revogar sessões
  await prisma.$transaction([
    prisma.portalUser.update({
      where: { id },
      data:  { isActive: false },
    }),
    prisma.portalSession.updateMany({
      where: { portalUserId: id, isRevoked: false },
      data:  { isRevoked: true },
    }),
  ]);

  return NextResponse.json({ ok: true, message: "Utilizador desactivado e sessões revogadas." });
}
