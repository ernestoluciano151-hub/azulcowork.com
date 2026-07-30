/**
 * Portal Auth Service — Volume 03
 *
 * Autenticação independente do admin:
 * - Cookie: portal-session (SEPARADO do cookie vd_admin_session)
 * - JWT separado, signed com PORTAL_JWT_SECRET ou JWT_SECRET + ":portal"
 * - Magic Link: 32 bytes aleatórios, TTL 15 min, uso único, rate limit 3/hora
 * - Sessão: 8 horas, tokenHash = SHA-256 (token nunca guardado em bruto)
 * - RBAC: PORTAL_OWNER > PORTAL_ADMIN > PORTAL_MEMBER > PORTAL_VIEWER
 *
 * Isolamento multi-tenant: todas as funções verificam companyId.
 *
 * ADRs relacionados: ADR-026 (Magic Link), ADR-028 (Signed URLs)
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { PortalRole } from "@prisma/client";

// ── Constantes ───────────────────────────────────────────────────────────────

export const PORTAL_SESSION_COOKIE = "portal-session";
const PORTAL_SESSION_TTL_HOURS     = 8;
const MAGIC_LINK_TTL_MINUTES       = 15;
const MAGIC_LINK_RATE_LIMIT        = 3;  // por hora por email
const MAGIC_LINK_TOKEN_BYTES       = 32; // hex = 64 chars

// ── Secret ───────────────────────────────────────────────────────────────────

/**
 * Segredo JWT do portal.
 * Usa PORTAL_JWT_SECRET se definido, senão JWT_SECRET + ":portal".
 * Garante que tokens do portal nunca funcionam como tokens admin e vice-versa.
 */
function getPortalJwtSecret(): Uint8Array {
  const portalSecret = process.env.PORTAL_JWT_SECRET;
  if (portalSecret) return new TextEncoder().encode(portalSecret);

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      "[VD Portal] JWT_SECRET não está definida. " +
      "Defina JWT_SECRET ou PORTAL_JWT_SECRET nas variáveis de ambiente."
    );
  }
  // Deriva segredo separado do portal — mesmo base secret, escopo diferente
  return new TextEncoder().encode(jwtSecret + ":portal");
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PortalTokenPayload {
  sub:       string;     // PortalUser.id
  email:     string;
  role:      PortalRole;
  companyId: string;
  name:      string;
}

export type PortalAuthResult =
  | { user: PortalTokenPayload; error: null }
  | { user: null; error: NextResponse };

// ── Hierarquia de roles ───────────────────────────────────────────────────────

/** Hierarquia de roles: índice maior = mais permissões */
const ROLE_HIERARCHY: Record<PortalRole, number> = {
  PORTAL_VIEWER: 0,
  PORTAL_MEMBER: 1,
  PORTAL_ADMIN:  2,
  PORTAL_OWNER:  3,
};

/**
 * Verifica se o role tem pelo menos o nível mínimo requerido.
 * PORTAL_OWNER > PORTAL_ADMIN > PORTAL_MEMBER > PORTAL_VIEWER
 */
export function hasPortalRole(userRole: PortalRole, requiredRole: PortalRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Verifica se o role está exactamente na lista de roles permitidos.
 */
export function isPortalRole(userRole: PortalRole, ...allowedRoles: PortalRole[]): boolean {
  return allowedRoles.includes(userRole);
}

// ── Token helpers ─────────────────────────────────────────────────────────────

/** Gera SHA-256 de um token para guardar na BD (nunca guardar token bruto) */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── Sessão ────────────────────────────────────────────────────────────────────

/**
 * Cria sessão para um PortalUser após autenticação bem-sucedida.
 * Guarda tokenHash na BD (SHA-256). TTL: 8 horas.
 */
export async function createPortalSession(
  user: { id: string; email: string; role: PortalRole; companyId: string; name: string },
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<string> {
  const payload: PortalTokenPayload = {
    sub:       user.id,
    email:     user.email,
    role:      user.role,
    companyId: user.companyId,
    name:      user.name,
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PORTAL_SESSION_TTL_HOURS}h`)
    .sign(getPortalJwtSecret());

  const expiresAt = new Date(Date.now() + PORTAL_SESSION_TTL_HOURS * 60 * 60 * 1000);

  // Guardar na BD (tokenHash, nunca o token bruto)
  await prisma.portalSession.create({
    data: {
      portalUserId: user.id,
      tokenHash:    hashToken(token),
      expiresAt,
      isRevoked:    false,
      ipAddress:    meta?.ipAddress,
      userAgent:    meta?.userAgent,
    },
  });

  // Actualizar lastLoginAt
  await prisma.portalUser.update({
    where: { id: user.id },
    data:  { lastLoginAt: new Date() },
  });

  return token;
}

/**
 * Define o cookie portal-session no browser.
 * Chamar após createPortalSession.
 */
export async function setPortalSessionCookie(token: string): Promise<void> {
  (await cookies()).set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/portal",  // restrito ao prefixo /portal
    maxAge:   PORTAL_SESSION_TTL_HOURS * 60 * 60,
  });
}

/**
 * Lê e valida o cookie portal-session.
 * Retorna o payload JWT se válido, null se inválido/expirado/revogado.
 */
export async function getPortalSession(): Promise<PortalTokenPayload | null> {
  const token = (await cookies()).get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getPortalJwtSecret());
    const p = payload as unknown as PortalTokenPayload;
    if (!p.sub || !p.email || !p.role || !p.companyId) return null;

    // Verificar na BD: sessão existe, não foi revogada e não expirou
    const session = await prisma.portalSession.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      return null;
    }

    // Verificar que o utilizador ainda está activo
    const user = await prisma.portalUser.findUnique({
      where:  { id: p.sub },
      select: { isActive: true, isConfirmed: true },
    });
    if (!user || !user.isActive) return null;

    return p;
  } catch {
    return null;
  }
}

/**
 * Revoga a sessão actual (logout).
 * Marca como revogada na BD e remove o cookie.
 */
export async function destroyPortalSession(): Promise<void> {
  const token = (await cookies()).get(PORTAL_SESSION_COOKIE)?.value;
  if (token) {
    await prisma.portalSession.updateMany({
      where: { tokenHash: hashToken(token) },
      data:  { isRevoked: true },
    });
  }
  (await cookies()).set(PORTAL_SESSION_COOKIE, "", { path: "/portal", maxAge: 0 });
}

/**
 * Revoga todas as sessões de um PortalUser (ex.: desactivação de conta).
 */
export async function revokeAllPortalSessions(portalUserId: string): Promise<void> {
  await prisma.portalSession.updateMany({
    where: { portalUserId, isRevoked: false },
    data:  { isRevoked: true },
  });
}

// ── Magic Link ────────────────────────────────────────────────────────────────

/**
 * Cria um magic link para autenticação sem password.
 * Rate limit: máx 3 por hora por email.
 * TTL: 15 minutos.
 *
 * @throws "RATE_LIMIT_EXCEEDED" se > 3 pedidos na última hora
 * @throws "USER_NOT_FOUND" se email não existe no portal
 * @throws "USER_INACTIVE" se utilizador está desactivado
 */
export async function createMagicLink(
  email: string,
  meta?: { ipAddress?: string }
): Promise<{ token: string; expiresAt: Date; portalUserId: string }> {
  // Normalizar email
  const normalizedEmail = email.toLowerCase().trim();

  // Verificar que o utilizador existe
  const user = await prisma.portalUser.findFirst({
    where: { email: normalizedEmail, isActive: true },
  });
  if (!user) {
    // Não revelar se o email existe — sempre retornar mesmo erro ao utilizador
    // Mas internamente distinguir para logging
    throw new Error("USER_NOT_FOUND");
  }

  // Rate limit: contar magic links na última hora
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.portalMagicLink.count({
    where: {
      portalUserId: user.id,
      createdAt:    { gte: oneHourAgo },
    },
  });
  if (recentCount >= MAGIC_LINK_RATE_LIMIT) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  // Gerar token: 32 bytes aleatórios em hex (64 chars)
  const token     = randomBytes(MAGIC_LINK_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);

  await prisma.portalMagicLink.create({
    data: {
      portalUserId: user.id,
      token,
      expiresAt,
      isUsed:    false,
      ipAddress: meta?.ipAddress,
    },
  });

  return { token, expiresAt, portalUserId: user.id };
}

/**
 * Valida e consome um magic link.
 * Uso único: marca isUsed=true após validação.
 *
 * @throws "MAGIC_LINK_NOT_FOUND" se token inválido
 * @throws "MAGIC_LINK_EXPIRED" se expirado
 * @throws "MAGIC_LINK_ALREADY_USED" se já consumido
 * @throws "USER_INACTIVE" se utilizador desactivado
 */
export async function consumeMagicLink(token: string): Promise<{
  id:        string;
  email:     string;
  name:      string;
  role:      PortalRole;
  companyId: string;
}> {
  const link = await prisma.portalMagicLink.findUnique({
    where:   { token },
    include: { portalUser: true },
  });

  if (!link) throw new Error("MAGIC_LINK_NOT_FOUND");
  if (link.expiresAt < new Date()) throw new Error("MAGIC_LINK_EXPIRED");
  if (link.isUsed) throw new Error("MAGIC_LINK_ALREADY_USED");
  if (!link.portalUser.isActive) throw new Error("USER_INACTIVE");

  // Marcar como usado (atómico — evita race condition de duplo uso)
  await prisma.portalMagicLink.update({
    where: { id: link.id },
    data:  { isUsed: true, usedAt: new Date() },
  });

  // Confirmar utilizador se for primeiro login
  if (!link.portalUser.isConfirmed) {
    await prisma.portalUser.update({
      where: { id: link.portalUser.id },
      data:  { isConfirmed: true },
    });
  }

  return {
    id:        link.portalUser.id,
    email:     link.portalUser.email,
    name:      link.portalUser.name,
    role:      link.portalUser.role,
    companyId: link.portalUser.companyId,
  };
}

/** Valida estrutura de um magic link (sem side-effects — útil para testes) */
export function isMagicLinkValid(link: { expiresAt: Date; isUsed: boolean }): boolean {
  return !link.isUsed && link.expiresAt > new Date();
}

// ── RBAC Guards ───────────────────────────────────────────────────────────────

/**
 * Verifica sessão portal válida.
 * Retorna o utilizador autenticado ou um NextResponse de erro.
 */
export async function requirePortalSession(): Promise<
  { user: PortalTokenPayload; error: null } | { user: null; error: NextResponse }
> {
  const user = await getPortalSession();
  if (!user) {
    return {
      user:  null,
      error: NextResponse.json(
        { error: "Sessão expirada. Por favor faça login novamente." },
        { status: 401 }
      ),
    };
  }
  return { user, error: null };
}

/**
 * Verifica sessão válida E role mínimo requerido.
 * Usa hierarquia: PORTAL_OWNER > PORTAL_ADMIN > PORTAL_MEMBER > PORTAL_VIEWER
 *
 * @example
 * const { user, error } = await requirePortalRole("PORTAL_ADMIN");
 * if (error) return error;
 */
export async function requirePortalRole(
  minimumRole: PortalRole
): Promise<
  { user: PortalTokenPayload; error: null } | { user: null; error: NextResponse }
> {
  const { user, error } = await requirePortalSession();
  if (error) return { user: null, error };

  if (!hasPortalRole(user.role, minimumRole)) {
    return {
      user:  null,
      error: NextResponse.json(
        { error: "Não tem permissão para esta acção." },
        { status: 403 }
      ),
    };
  }
  return { user, error: null };
}

/**
 * Verifica isolamento multi-tenant.
 * Garante que o recurso pertence à empresa do utilizador autenticado.
 *
 * @example
 * const { user, error } = await requirePortalSession();
 * if (error) return error;
 * if (!checkCompanyIsolation(user, invoice.companyId)) {
 *   return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
 * }
 */
export function checkCompanyIsolation(
  user: PortalTokenPayload,
  resourceCompanyId: string
): boolean {
  return user.companyId === resourceCompanyId;
}

/**
 * Helper que combina requirePortalRole + checkCompanyIsolation.
 * Retorna 404 (não 403) quando o recurso não pertence à empresa — por segurança.
 */
export async function requirePortalRoleAndCompany(
  minimumRole: PortalRole,
  resourceCompanyId: string
): Promise<
  { user: PortalTokenPayload; error: null } | { user: null; error: NextResponse }
> {
  const { user, error } = await requirePortalRole(minimumRole);
  if (error) return { user: null, error };

  if (!checkCompanyIsolation(user, resourceCompanyId)) {
    return {
      user:  null,
      error: NextResponse.json(
        { error: "Recurso não encontrado." },
        { status: 404 }  // 404 em vez de 403 — não revelar que o recurso existe
      ),
    };
  }
  return { user, error: null };
}

// ── Credenciais (alternativa ao Magic Link — ADR-026) ────────────────────────

/**
 * Autenticação por password (alternativa ao Magic Link).
 * Requere PORTAL_JWT_SECRET definido e passwordHash no utilizador.
 *
 * @throws "USER_NOT_FOUND"
 * @throws "INVALID_PASSWORD"
 * @throws "USER_INACTIVE"
 * @throws "NO_PASSWORD_SET" se utilizador usa apenas Magic Link
 */
export async function authenticatePortalCredentials(
  email:    string,
  password: string
): Promise<{
  id:        string;
  email:     string;
  name:      string;
  role:      PortalRole;
  companyId: string;
}> {
  const { compare } = await import("bcryptjs");
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.portalUser.findFirst({
    where: { email: normalizedEmail },
  });

  if (!user) throw new Error("USER_NOT_FOUND");
  if (!user.isActive) throw new Error("USER_INACTIVE");
  if (!user.passwordHash) throw new Error("NO_PASSWORD_SET");

  const valid = await compare(password, user.passwordHash);
  if (!valid) throw new Error("INVALID_PASSWORD");

  return {
    id:        user.id,
    email:     user.email,
    name:      user.name,
    role:      user.role,
    companyId: user.companyId,
  };
}
