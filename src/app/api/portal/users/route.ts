/**
 * GET  /api/portal/users — lista utilizadores do portal da empresa
 * POST /api/portal/users — convidar novo utilizador (PORTAL_ADMIN ou PORTAL_OWNER)
 *
 * Regra: companyId obrigatório em todas as queries (isolamento multi-tenant).
 * RBAC: mutações requerem PORTAL_ADMIN ou superior.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession, requirePortalRole } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";
import { PortalRole } from "@prisma/client";
import { z } from "zod";

// ── GET — lista utilizadores ───────────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const users = await prisma.portalUser.findMany({
      where:   { companyId: user.companyId },  // isolamento
      orderBy: { createdAt: "asc" },
      select: {
        id:          true,
        name:        true,
        email:       true,
        phone:       true,
        role:        true,
        isActive:    true,
        isConfirmed: true,
        lastLoginAt: true,
        createdAt:   true,
        // Não expor passwordHash, pushEndpoint, pushP256dh, pushAuth
      },
    });

    return NextResponse.json({ data: users });
  } catch (err) {
    console.error("[GET /api/portal/users]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}

// ── POST — criar utilizador ────────────────────────────────────────────────────

const createSchema = z.object({
  name:  z.string().min(2).max(120),
  email: z.string().email("Email inválido."),
  phone: z.string().max(30).optional(),
  role:  z.enum([
    PortalRole.PORTAL_VIEWER,
    PortalRole.PORTAL_MEMBER,
    PortalRole.PORTAL_ADMIN,
    // PORTAL_OWNER criado via transfer-ownership — nunca directamente
  ], { errorMap: () => ({ message: "Role inválida." }) }),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_ADMIN);
    if (error) return error;

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const { name, email, phone, role } = parsed.data;

    // Verificar duplicado na mesma empresa
    const existing = await prisma.portalUser.findUnique({
      where: { companyId_email: { companyId: user.companyId, email } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Já existe um utilizador com este email na sua empresa." },
        { status: 409 }
      );
    }

    const newUser = await prisma.portalUser.create({
      data: {
        companyId: user.companyId,
        name,
        email,
        phone,
        role,
        isActive:    true,
        isConfirmed: false,  // confirmado após magic link ou 1.º login
      },
      select: {
        id:          true,
        name:        true,
        email:       true,
        role:        true,
        isActive:    true,
        isConfirmed: true,
        createdAt:   true,
      },
    });

    return NextResponse.json({ ok: true, data: newUser }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/portal/users]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
