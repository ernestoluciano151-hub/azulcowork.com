/**
 * POST /api/admin/portal/magic-link
 *
 * Gera um Magic Link de primeiro acesso para um PortalUser.
 * Chamado pelo admin após criar o PortalUser — envia o link ao cliente
 * para que este faça o seu primeiro login sem necessitar de password.
 *
 * O link tem TTL de 15 minutos (configurado em portal-auth-service.ts).
 * Pode ser reenviado ilimitadamente pelo admin (sem rate limit por email aqui —
 * o rate limit interno aplica-se apenas ao self-service do portal).
 *
 * Requer: AdminRole.ADMIN
 * Resposta: { token, expiresAt, magicLinkUrl, portalUserId }
 *
 * O admin envia o magicLinkUrl ao cliente (email, WhatsApp, etc.).
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole }                  from "@prisma/client";
import { prisma }                     from "@/lib/prisma";
import { requireRole }                from "@/lib/auth";
import { z }                          from "zod";
import { randomBytes }                from "crypto";

const schema = z.object({
  portalUserId: z.string().cuid("portalUserId inválido."),
});

const MAGIC_LINK_TTL_MINUTES = 15;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const { portalUserId } = parsed.data;

  // Verificar que o utilizador existe e está activo
  const user = await prisma.portalUser.findUnique({
    where:  { id: portalUserId },
    select: { id: true, email: true, name: true, isActive: true, companyId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "PortalUser não encontrado." }, { status: 404 });
  }
  if (!user.isActive) {
    return NextResponse.json(
      { error: "Não é possível gerar magic link para utilizador inactivo." },
      { status: 422 }
    );
  }

  // Gerar token (32 bytes hex = 64 chars)
  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);

  await prisma.portalMagicLink.create({
    data: {
      portalUserId: user.id,
      token,
      expiresAt,
      isUsed:    false,
      ipAddress: null,
    },
  });

  // URL do portal (usar NEXT_PUBLIC_APP_URL ou fallback para produção)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://azulcowork.com";
  const magicLinkUrl = `${baseUrl}/portal/auth/magic?token=${token}`;

  return NextResponse.json({
    ok:           true,
    token,
    expiresAt,
    magicLinkUrl,
    portalUserId: user.id,
    userEmail:    user.email,
    userName:     user.name,
    ttlMinutes:   MAGIC_LINK_TTL_MINUTES,
  }, { status: 201 });
}
