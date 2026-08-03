/**
 * POST /api/portal/auth/magic-link
 *
 * Solicitar envio de magic link para autenticação sem password.
 * Rate limit: 3 pedidos por hora por email (enforçado no portal-auth-service).
 * Resposta: sempre 200 (não revelar se o email existe — segurança).
 */

import { NextRequest, NextResponse } from "next/server";
import { createMagicLink } from "@/lib/portal-auth-service";
import { sendEmail } from "@/lib/communication-service";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Email inválido.").max(255),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? undefined;

    try {
      const { token, expiresAt } = await createMagicLink(email, { ipAddress });

      // Construir URL do magic link — usa a origem do próprio pedido como
      // fallback em vez de localhost, para nunca enviar um link inválido em
      // produção se NEXT_PUBLIC_APP_URL não estiver definida.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
      const magicLinkUrl = `${appUrl}/api/portal/auth/magic?token=${token}`;
      const expiresMinutes = Math.round(
        (expiresAt.getTime() - Date.now()) / 60_000
      ).toString();

      // Enviar email — fire-and-forget (falha de email nunca bloqueia o 200)
      void sendEmail({
        templateSlug: "portal-magic-link",
        to: email,
        subject: "O seu link de acesso — Azul Coworking",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#1e40af">Azul Coworking — Portal do Cliente</h2>
            <p>Clique no botão abaixo para aceder ao seu portal. O link é válido por ${expiresMinutes} minutos e só pode ser utilizado uma vez.</p>
            <p style="text-align:center;margin:32px 0">
              <a href="${magicLinkUrl}"
                 style="background:#1e40af;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
                Aceder ao Portal
              </a>
            </p>
            <p style="font-size:12px;color:#6b7280">
              Se não solicitou este acesso, ignore este email.<br>
              Link alternativo: <a href="${magicLinkUrl}">${magicLinkUrl}</a>
            </p>
          </div>`,
        vars: { magicLinkUrl, expiresMinutes, email },
        channel: "transactional",
        entityType: "PORTAL_USER",
        triggeredBy: "SYSTEM",
      }).catch((err: unknown) =>
        console.error("[Portal MagicLink] Erro ao enviar email:", err)
      );

      // Em desenvolvimento: log do token para facilitar testes locais sem SMTP
      if (process.env.NODE_ENV === "development") {
        console.log(`[Portal MagicLink] Token para ${email}: ${token} (expira ${expiresAt.toISOString()})`);
        console.log(`[Portal MagicLink] URL: ${magicLinkUrl}`);
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      // RATE_LIMIT_EXCEEDED: retornar 429
      if (code === "RATE_LIMIT_EXCEEDED") {
        return NextResponse.json(
          { error: "Demasiados pedidos. Por favor aguarde alguns minutos antes de tentar novamente." },
          { status: 429 }
        );
      }
      // USER_NOT_FOUND: responder com 200 (não revelar se o email existe)
      // Logging interno para monitoring
      if (code !== "USER_NOT_FOUND") {
        console.error("[Portal MagicLink] Erro inesperado:", err);
      }
    }

    // Sempre retornar 200 — não revelar se o email existe no sistema
    return NextResponse.json({
      ok: true,
      message: "Se este email estiver registado, receberá um link de acesso em breve.",
    });
  } catch (err) {
    console.error("[POST /api/portal/auth/magic-link]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
