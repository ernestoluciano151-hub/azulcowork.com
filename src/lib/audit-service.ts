/**
 * Audit Service — Volume 05
 *
 * Registo imutável de todas as operações críticas do sistema.
 *
 * REGRAS (ADR-035):
 * 1. recordAudit é sempre chamado POST-COMMIT, fora de $transaction
 * 2. O caller DEVE encadear .catch() — falha no audit nunca bloqueia a operação principal
 * 3. before/after são sanitizados internamente (campos sensíveis removidos)
 * 4. sanitizeForAudit é exportada para uso explícito pelo caller (defesa dupla)
 *
 * Política de retenção: 365 dias activo → arquivo trimestral (ver ADR-035)
 */

import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";

// ── Campos sensíveis — removidos de before/after em qualquer circunstância ───
const SENSITIVE_FIELDS = new Set([
  "passwordHash",
  "totpSecret",
  "tokenHash",
  "token",
  "password",
  "secret",
  "refreshToken",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuditActor = {
  id:    string;  // AdminUser.id | "SYSTEM" | "UNKNOWN"
  role:  string;  // AdminRole | "SYSTEM" | "UNKNOWN"
  email: string;
};

export type AuditParams = {
  actor:      AuditActor;
  action:     AuditAction;
  entity:     string;         // "Payment" | "Reservation" | "AdminUser" | ...
  entityId:   string;         // id da entidade afectada
  entityRef?: string;         // referência legível: "REC-2026-000001", email, ...
  before?:    Record<string, unknown>;  // estado anterior — sanitizado
  after?:     Record<string, unknown>;  // estado posterior — sanitizado
  ipAddress?: string;
  userAgent?: string;
  metadata?:  Record<string, unknown>;  // contexto livre: reason, channel, ...
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Remove campos sensíveis de um objecto antes de passar a recordAudit.
 * Chamar explicitamente no caller antes de construir before/after.
 * recordAudit também aplica internamente como última linha de defesa.
 *
 * @example
 * const safe = sanitizeForAudit({ id, email, passwordHash, role });
 * // safe = { id, email, role }  — passwordHash removido
 */
export function sanitizeForAudit<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj)) {
    if (!SENSITIVE_FIELDS.has(key)) {
      result[key as keyof T] = obj[key] as T[keyof T];
    }
  }
  return result;
}

// ── Actors predefinidos ───────────────────────────────────────────────────────

/** Actor para operações automáticas do sistema (crons, eventos internos) */
export const SYSTEM_ACTOR: AuditActor = {
  id:    "SYSTEM",
  role:  "SYSTEM",
  email: "system@vdplatform",
};

/** Actor para tentativas de login com email desconhecido */
export const UNKNOWN_ACTOR: AuditActor = {
  id:    "UNKNOWN",
  role:  "UNKNOWN",
  email: "unknown",
};

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Regista um evento de auditoria de forma assíncrona e não-bloqueante.
 *
 * SEMPRE usar com .catch():
 * ```ts
 * recordAudit({ actor, action: "PAYMENT_CREATED", entity: "Payment", entityId: p.id })
 *   .catch(err => console.error("[Audit]", err));
 * ```
 */
export async function recordAudit(params: AuditParams): Promise<void> {
  const {
    actor, action, entity, entityId, entityRef,
    before, after, ipAddress, userAgent, metadata,
  } = params;

  await prisma.auditLog.create({
    data: {
      actorId:    actor.id,
      actorRole:  actor.role,
      actorEmail: actor.email,
      action,
      entity,
      entityId,
      entityRef:  entityRef ?? null,
      // Sanitização interna — protecção final independente do caller
      before:     before ? (sanitizeForAudit(before) as object) : undefined,
      after:      after  ? (sanitizeForAudit(after)  as object) : undefined,
      ipAddress:  ipAddress ?? null,
      userAgent:  userAgent ?? null,
      metadata:   metadata  ? (metadata as object) : undefined,
    },
  });
}

// ── Helper para extrair actor de sessão RBAC ──────────────────────────────────

/**
 * Constrói um AuditActor a partir do objecto de sessão retornado por requireSession/requireRole.
 */
export function actorFromSession(session: {
  sub:    string;
  email:  string;
  role?:  string;
  name?:  string;
}): AuditActor {
  return {
    id:    session.sub,
    role:  session.role ?? "UNKNOWN",
    email: session.email,
  };
}
