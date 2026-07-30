import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { AdminRole } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE     = "vd_admin_session";
const TOTP_TEMP_SCOPE    = "totp-verify";
const TOTP_TEMP_MAX_AGE  = 5 * 60;   // 5 minutos em segundos
const SESSION_TTL_HOURS  = 12;

const FALLBACK_SECRET = "fallback-secret-troque-me";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === FALLBACK_SECRET || secret.length < 32) {
    throw new Error(
      "[VD Platform] JWT_SECRET não está definida, usa o valor padrão inseguro ou é demasiado curta. " +
      "Defina uma JWT_SECRET com pelo menos 32 caracteres: openssl rand -base64 32"
    );
  }
  return new TextEncoder().encode(secret);
}

/** SHA-256 de um JWT — usado para indexar AdminSession sem guardar o token em bruto */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Cria sessão JWT + regista AdminSession na BD (VOL05-2).
 * @param meta  IP e User-Agent do pedido (para rastreamento de sessões)
 */
export async function createSession(
  payload: { sub: string; email: string; role?: AdminRole; name?: string },
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(getJwtSecret());

  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  // Registar sessão na BD — permite revogar individualmente (VOL05-2)
  await prisma.adminSession.create({
    data: {
      adminUserId:  payload.sub,
      tokenHash:    hashToken(token),
      ipAddress:    meta?.ipAddress ?? null,
      userAgent:    meta?.userAgent ?? null,
      expiresAt,
      lastActiveAt: new Date(),
    },
  });

  // Actualizar lastLoginAt + lastLoginIp no AdminUser
  await prisma.adminUser.update({
    where: { id: payload.sub },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: meta?.ipAddress ?? null,
    },
  }).catch(() => { /* não crítico — sessão já foi criada */ });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   SESSION_TTL_HOURS * 60 * 60,
  });
}

export async function destroySession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    // Revogar sessão na BD
    await prisma.adminSession.updateMany({
      where: { tokenHash: hashToken(token), isRevoked: false },
      data:  { isRevoked: true },
    }).catch(() => { /* não crítico */ });
  }
  (await cookies()).set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

// ---------------------------------------------------------------------------
// Token temporário TOTP — emitido após password válida, antes do código TOTP
// Scope "totp-verify" garante que o token não pode ser usado como sessão completa
// ---------------------------------------------------------------------------

/**
 * Emite um JWT temporário com scope "totp-verify" (validade: 5 minutos).
 * Usado quando o utilizador validou a password mas ainda não inseriu o código TOTP.
 */
export async function createTempToken(payload: { sub: string; email: string }): Promise<string> {
  return new SignJWT({ ...payload, scope: TOTP_TEMP_SCOPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOTP_TEMP_MAX_AGE}s`)
    .sign(getJwtSecret());
}

/**
 * Verifica um token temporário TOTP. Retorna `null` se inválido, expirado ou scope incorrecto.
 */
export async function verifyTempToken(
  token: string
): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.scope !== TOTP_TEMP_SCOPE) return null;
    if (!payload.sub || !payload.email) return null;
    return { sub: payload.sub as string, email: payload.email as string };
  } catch {
    return null;
  }
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const p = payload as { sub: string; email: string; role?: AdminRole; name?: string };
    if (!p.sub) return null;

    // VOL05-2: verificar que a sessão não foi revogada na BD
    const session = await prisma.adminSession.findUnique({
      where:  { tokenHash: hashToken(token) },
      select: { isRevoked: true, expiresAt: true },
    });
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      return null;
    }

    // Actualizar lastActiveAt de forma não-bloqueante
    prisma.adminSession.update({
      where: { tokenHash: hashToken(token) },
      data:  { lastActiveAt: new Date() },
    }).catch(() => { /* não crítico */ });

    return p;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// RBAC helpers — usar em todas as API Routes protegidas
// Princípio: Deny by Default — qualquer falha retorna 401 ou 403
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

export type SessionPayload = { sub: string; email: string; role?: AdminRole; name?: string };

export type AuthResult =
  | { session: SessionPayload; error: null }
  | { session: null; error: NextResponse };

/**
 * Verifica que existe sessão válida.
 * Usar quando qualquer utilizador autenticado pode aceder (ex: /api/notifications).
 *
 * @example
 * const { session, error } = await requireSession();
 * if (error) return error;
 */
export async function requireSession(): Promise<AuthResult> {
  const session = await getSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }
  return { session, error: null };
}

/**
 * Verifica sessão válida E que o role está na lista autorizada.
 * Usar quando o acesso é restrito a roles específicos.
 *
 * @example
 * const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
 * if (error) return error;
 */
export async function requireRole(...roles: AdminRole[]): Promise<AuthResult> {
  const session = await getSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }
  if (!session.role || !roles.includes(session.role)) {
    return { session: null, error: NextResponse.json({ error: "Sem permissão." }, { status: 403 }) };
  }
  return { session, error: null };
}

export { SESSION_COOKIE, TOTP_TEMP_SCOPE };
