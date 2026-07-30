import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE        = "vd_admin_session";
const PORTAL_SESSION_COOKIE = "portal-session";

const FALLBACK_SECRET = "fallback-secret-troque-me";

// Nota: middleware corre em Edge Runtime — não pode importar de src/lib/auth.ts.
// Esta função é intencionalmente duplicada (isolamento de runtime — ver ADR-004).
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === FALLBACK_SECRET) {
    throw new Error(
      "[VD Platform] JWT_SECRET não está definida ou está a usar o valor padrão inseguro."
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Segredo do portal: PORTAL_JWT_SECRET ou JWT_SECRET + ":portal" (ADR-026).
 * Segredos separados garantem isolamento total entre sessões admin e portal.
 */
function getPortalJwtSecret(): Uint8Array {
  const portalSecret = process.env.PORTAL_JWT_SECRET;
  if (portalSecret) return new TextEncoder().encode(portalSecret);
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("[VD Portal] JWT_SECRET não definida.");
  return new TextEncoder().encode(jwtSecret + ":portal");
}

// Rotas exclusivas para administradores (role === "ADMIN")
const ADMIN_ONLY_PATHS = [
  "/admin/delete-requests",
  "/admin/configuracoes",
  "/admin/settings",
];

// Rotas do portal que não requerem autenticação
const PORTAL_PUBLIC_PATHS = [
  "/portal/login",
  "/portal/auth/",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Portal ──────────────────────────────────────────────────────────────────
  if (pathname.startsWith("/portal")) {
    const isPublic = PORTAL_PUBLIC_PATHS.some(p => pathname.startsWith(p));
    if (isPublic) return NextResponse.next();

    const portalToken = req.cookies.get(PORTAL_SESSION_COOKIE)?.value;
    if (!portalToken) {
      return NextResponse.redirect(new URL("/portal/login", req.url));
    }

    try {
      await jwtVerify(portalToken, getPortalJwtSecret());
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/portal/login", req.url));
    }
  }

  // ── Admin ───────────────────────────────────────────────────────────────────
  const isProtected = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    // RBAC: páginas admin-only apenas para ADMIN
    const requiresAdmin = ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p));
    if (requiresAdmin && payload.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
