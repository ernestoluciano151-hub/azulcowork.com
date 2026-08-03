/**
 * GET /api/portal/auth/magic?token=<token>
 *
 * Valida o magic link, cria sessão e redireciona para o portal.
 * Token: uso único, TTL 15 minutos.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  consumeMagicLink,
  createPortalSession,
  setPortalSessionCookie,
} from "@/lib/portal-auth-service";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Base absoluto derivado do próprio pedido — NextResponse.redirect() exige
  // um URL absoluto e lança excepção com um relativo. Antes dependia só de
  // NEXT_PUBLIC_APP_URL; se essa var não estivesse definida em produção,
  // PORTAL_BASE ficava "" e todo o fluxo (sucesso e erro) entrava em loop
  // de excepções não tratadas — era isso que causava o ecrã preso em
  // "a validar acesso".
  const PORTAL_BASE = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token || token.length !== 64) {
      return NextResponse.redirect(
        `${PORTAL_BASE}/portal/auth/login?error=invalid_token`
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    try {
      const user = await consumeMagicLink(token);
      const sessionToken = await createPortalSession(user, { ipAddress, userAgent });
      await setPortalSessionCookie(sessionToken);

      // Redirecionar para dashboard do portal
      return NextResponse.redirect(`${PORTAL_BASE}/portal/dashboard`);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";

      const errorMap: Record<string, string> = {
        MAGIC_LINK_NOT_FOUND:   "invalid_token",
        MAGIC_LINK_EXPIRED:     "expired_token",
        MAGIC_LINK_ALREADY_USED:"used_token",
        USER_INACTIVE:          "account_inactive",
      };

      const errorParam = errorMap[code] ?? "unknown_error";
      return NextResponse.redirect(
        `${PORTAL_BASE}/portal/auth/login?error=${errorParam}`
      );
    }
  } catch (err) {
    console.error("[GET /api/portal/auth/magic]", err);
    return NextResponse.redirect(
      `${PORTAL_BASE}/portal/auth/login?error=server_error`
    );
  }
}
