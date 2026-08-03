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
import { sendEmail }                  from "@/lib/communication-service";
import { z }                          from "zod";
import { randomBytes }                from "crypto";

const schema = z.object({
  portalUserId: z.string().cuid("portalUserId inválido."),
  // Se true, tenta enviar o link por email ao próprio utilizador (além de
  // devolvê-lo na resposta para o admin copiar/reenviar manualmente).
  sendEmail: z.boolean().optional(),
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

  const { portalUserId, sendEmail: shouldSendEmail } = parsed.data;

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

  // URL do portal — usa NEXT_PUBLIC_APP_URL se definida, senão a origem do
  // próprio pedido (garante o mesmo domínio que valida o token em
  // /api/portal/auth/magic, evitando desfasamentos entre ambientes).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const magicLinkUrl = `${baseUrl}/portal/auth/magic?token=${token}`;

  // Envio de email opcional — aguardado (não fire-and-forget) para que o
  // admin saiba de imediato se chegou a sair ou se falhou (ex: SMTP em
  // baixo), em vez de assumir silenciosamente que foi entregue.
  let emailResult: { attempted: boolean; success: boolean; error?: string } = {
    attempted: false, success: false,
  };
  if (shouldSendEmail) {
    const result = await sendEmail({
      templateSlug: "portal-magic-link",
      to: user.email,
      subject: "O seu link de acesso — Azul Coworking",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1e40af">Azul Coworking — Portal do Cliente</h2>
          <p>Olá ${user.name}, o seu acesso ao Portal do Cliente foi criado. Clique no botão abaixo para entrar. O link é válido por ${MAGIC_LINK_TTL_MINUTES} minutos e só pode ser utilizado uma vez.</p>
          <p style="text-align:center;margin:32px 0">
            <a href="${magicLinkUrl}"
               style="background:#1e40af;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
              Aceder ao Portal
            </a>
          </p>
          <p style="font-size:12px;color:#6b7280">
            Se não esperava este email, ignore-o.<br>
            Link alternativo: <a href="${magicLinkUrl}">${magicLinkUrl}</a>
          </p>
        </div>`,
      vars: { magicLinkUrl, userName: user.name, email: user.email },
      channel: "transactional",
      entityType: "PORTAL_USER",
      entityId: user.id,
      triggeredBy: "ADMIN",
    });
    emailResult = { attempted: true, success: result.success, error: result.error };
  }

  return NextResponse.json({
    ok:           true,
    token,
    expiresAt,
    magicLinkUrl,
    portalUserId: user.id,
    userEmail:    user.email,
    userName:     user.name,
    ttlMinutes:   MAGIC_LINK_TTL_MINUTES,
    emailResult,
  }, { status: 201 });
}
