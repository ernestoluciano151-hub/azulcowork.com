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

const PORTAL_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function GET(req: NextRequest): Promise<NextResponse> {
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
