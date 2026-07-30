/**
 * GET    /api/portal/users/[id]  — detalhe de utilizador
 * PATCH  /api/portal/users/[id]  — actualizar utilizador (PORTAL_ADMIN ou superior)
 * DELETE /api/portal/users/[id]  — desactivar utilizador (não apaga; revoga sessões)
 *
 * RBAC:
 *   GET    — qualquer utilizador autenticado (vê o seu próprio ou se for ADMIN/OWNER)
 *   PATCH  — PORTAL_ADMIN ou PORTAL_OWNER (não pode alterar para PORTAL_OWNER via PATCH)
 *   DELETE — PORTAL_ADMIN ou PORTAL_OWNER (não pode desactivar o PORTAL_OWNER único)
 *
 * Isolamento: companyId obrigatório.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requirePortalSession,
  requirePortalRole,
  revokeAllPortalSessions,
  hasPortalRole,
} from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";
import { PortalRole } from "@prisma/client";
import { z } from "zod";

// ── GET — detalhe ──────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { id } = await params;

    // Utilizador pode ver o seu próprio perfil; ADMIN/OWNER podem ver qualquer um
    const isSelf = user.sub === id;
    if (!isSelf && !hasPortalRole(user.role as PortalRole, PortalRole.PORTAL_ADMIN)) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    const target = await prisma.portalUser.findFirst({
      where: {
        id,
        companyId: user.companyId,  // isolamento multi-tenant
      },
      select: {
        id:             true,
        name:           true,
        email:          true,
        phone:          true,
        role:           true,
        isActive:       true,
        isConfirmed:    true,
        notifyEmail:    true,
        notifyWhatsapp: true,
        notifyPush:     true,
        notifyInApp:    true,
        lastLoginAt:    true,
        createdAt:      true,
        updatedAt:      true,
        // Não expor passwordHash, push keys
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: target });
  } catch (err) {
    console.error("[GET /api/portal/users/[id]]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}

// ── PATCH — actualizar utilizador ──────────────────────────────────────────────

const patchSchema = z.object({
  name:           z.string().min(2).max(120).optional(),
  phone:          z.string().max(30).optional().nullable(),
  role:           z.enum([
    PortalRole.PORTAL_VIEWER,
    PortalRole.PORTAL_MEMBER,
    PortalRole.PORTAL_ADMIN,
    // PORTAL_OWNER só via /transfer-ownership
  ]).optional(),
  notifyEmail:    z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
  notifyPush:     z.boolean().optional(),
  notifyInApp:    z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Pelo menos um campo deve ser fornecido.",
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_ADMIN);
    if (error) return error;

    const { id } = await params;

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    // Verificar que o alvo pertence à empresa
    const target = await prisma.portalUser.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    // PORTAL_ADMIN não pode editar PORTAL_OWNER (só PORTAL_OWNER pode)
    if (
      target.role === PortalRole.PORTAL_OWNER
      && !hasPortalRole(user.role as PortalRole, PortalRole.PORTAL_OWNER)
    ) {
      return NextResponse.json(
        { error: "Apenas o dono pode editar a sua conta." },
        { status: 403 }
      );
    }

    const updated = await prisma.portalUser.update({
      where: { id },
      data:  parsed.data,
      select: {
        id:             true,
        name:           true,
        email:          true,
        phone:          true,
        role:           true,
        isActive:       true,
        notifyEmail:    true,
        notifyWhatsapp: true,
        notifyPush:     true,
        notifyInApp:    true,
        updatedAt:      true,
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("[PATCH /api/portal/users/[id]]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}

// ── DELETE — desactivar utilizador ────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_ADMIN);
    if (error) return error;

    const { id } = await params;

    // Não se pode desactivar a si próprio
    if (user.sub === id) {
      return NextResponse.json(
        { error: "Não pode desactivar a sua própria conta." },
        { status: 409 }
      );
    }

    const target = await prisma.portalUser.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    // Não pode desactivar PORTAL_OWNER (único por empresa)
    if (target.role === PortalRole.PORTAL_OWNER) {
      return NextResponse.json(
        { error: "Não é possível desactivar o dono do portal. Transfira a propriedade primeiro." },
        { status: 409 }
      );
    }

    // PORTAL_ADMIN não pode desactivar outro PORTAL_ADMIN (só PORTAL_OWNER pode)
    if (
      target.role === PortalRole.PORTAL_ADMIN
      && !hasPortalRole(user.role as PortalRole, PortalRole.PORTAL_OWNER)
    ) {
      return NextResponse.json(
        { error: "Apenas o dono pode desactivar um administrador." },
        { status: 403 }
      );
    }

    if (!target.isActive) {
      return NextResponse.json(
        { error: "Utilizador já está desactivado." },
        { status: 409 }
      );
    }

    // Desactivar + revogar sessões em paralelo
    await Promise.all([
      prisma.portalUser.update({
        where: { id },
        data:  { isActive: false },
      }),
      revokeAllPortalSessions(id),
    ]);

    return NextResponse.json({
      ok:      true,
      message: "Utilizador desactivado e sessões revogadas.",
    });
  } catch (err) {
    console.error("[DELETE /api/portal/users/[id]]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
