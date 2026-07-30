/**
 * POST /api/portal/auth/login
 *
 * Autenticação por credenciais (alternativa ao Magic Link — ADR-026).
 * Só funciona se o PortalUser tiver passwordHash definido.
 *
 * Rate limiting: isLoginRateLimited — 10 tentativas / 15 min por IP.
 * Protege contra brute-force de passwords do portal.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  authenticatePortalCredentials,
  createPortalSession,
  setPortalSessionCookie,
} from "@/lib/portal-auth-service";
import { isLoginRateLimited } from "@/lib/rateLimit";
import { z } from "zod";

const schema = z.object({
  email:    z.string().email("Email inválido.").max(255),
  password: z.string().min(1, "Password obrigatória.").max(128),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limiting — brute-force protection
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
  if (isLoginRateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiadas tentativas. Tente novamente em 15 minutos." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const ipAddress = ip !== "unknown" ? ip : undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    try {
      const user = await authenticatePortalCredentials(email, password);
      const token = await createPortalSession(user, { ipAddress, userAgent });
      await setPortalSessionCookie(token);

      return NextResponse.json({
        ok: true,
        user: {
          id:        user.id,
          name:      user.name,
          email:     user.email,
          role:      user.role,
          companyId: user.companyId,
        },
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";

      if (code === "USER_NOT_FOUND" || code === "INVALID_PASSWORD") {
        // Mesma mensagem para ambos — não revelar qual é o erro
        return NextResponse.json(
          { error: "Email ou password incorrectos." },
          { status: 401 }
        );
      }
      if (code === "USER_INACTIVE") {
        return NextResponse.json(
          { error: "Conta desactivada. Contacte o suporte do Azul Coworking." },
          { status: 403 }
        );
      }
      if (code === "NO_PASSWORD_SET") {
        return NextResponse.json(
          { error: "Esta conta usa autenticação por link. Por favor solicite um link de acesso." },
          { status: 400 }
        );
      }

      throw err; // Erro inesperado — vai para o catch externo
    }
  } catch (err) {
    console.error("[POST /api/portal/auth/login]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
