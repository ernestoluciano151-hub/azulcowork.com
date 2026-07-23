import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "vd_admin_session";
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret-troque-me");

// Rotas exclusivas para administradores (role === "ADMIN")
const ADMIN_ONLY_PATHS = [
  "/admin/delete-requests",
  "/admin/configuracoes",
  "/admin/settings",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, secret());

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
  matcher: ["/admin/:path*"]
};
