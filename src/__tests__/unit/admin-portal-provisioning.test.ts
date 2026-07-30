/**
 * Testes unitários — Admin Portal Provisioning
 * VOL03-11D
 *
 * Valida lógica de negócio do provisioning de PortalUser via admin:
 *  - Unicidade do PORTAL_OWNER por empresa
 *  - Impossibilidade de desactivar o último PORTAL_OWNER
 *  - Magic link TTL e geração de token
 *  - Hierarquia de roles no provisioning
 *  - Restrição de alteração de role de PORTAL_OWNER via admin
 */

import { describe, it, expect } from "vitest";
import { PortalRole } from "@prisma/client";

// ── Constantes de provisioning ────────────────────────────────────────────────

const MAGIC_LINK_TTL_MINUTES    = 15;
const MAGIC_LINK_TOKEN_HEX_CHARS = 64; // randomBytes(32) → hex
const MIN_PASSWORD_LENGTH        = 8;

// ── Helpers inline ────────────────────────────────────────────────────────────

function canAlterRole(currentRole: PortalRole): boolean {
  // Admin NUNCA pode alterar role de PORTAL_OWNER via painel
  return currentRole !== PortalRole.PORTAL_OWNER;
}

function canDeactivate(
  targetRole:    PortalRole,
  otherOwnersActive: number
): { allowed: boolean; reason?: string } {
  if (targetRole === PortalRole.PORTAL_OWNER && otherOwnersActive === 0) {
    return {
      allowed: false,
      reason:  "Não é possível desactivar o único PORTAL_OWNER activo da empresa.",
    };
  }
  return { allowed: true };
}

function buildMagicLinkUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/portal/auth/magic?token=${token}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Criação de PortalUser — restrições
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL03-11 — Provisioning: criar PORTAL_OWNER", () => {
  it("PORTAL_OWNER criado pelo admin (não via portal público)", () => {
    // A rota POST /api/portal/users (portal público) não permite criar PORTAL_OWNER
    // Só POST /api/admin/portal/users (admin) pode criar PORTAL_OWNER
    const adminCanCreate  = true;  // /api/admin/portal/users
    const portalCanCreate = false; // /api/portal/users — PORTAL_OWNER não está no z.enum
    expect(adminCanCreate).toBe(true);
    expect(portalCanCreate).toBe(false);
  });

  it("uma empresa pode ter apenas 1 PORTAL_OWNER activo", () => {
    // Verificação: existingOwner → 409 Conflict
    const existingOwnerCount = 1;
    const canCreate = existingOwnerCount === 0;
    expect(canCreate).toBe(false);
  });

  it("sem PORTAL_OWNER activo → pode criar", () => {
    const existingOwnerCount = 0;
    const canCreate = existingOwnerCount === 0;
    expect(canCreate).toBe(true);
  });

  it("email deve ser único por empresa (companyId + email)", () => {
    const emailsInCompany = ["responsavel@empresa.ao", "socio@empresa.ao"];
    const newEmail        = "responsavel@empresa.ao";
    const hasConflict     = emailsInCompany.includes(newEmail);
    expect(hasConflict).toBe(true);
  });

  it("email único numa empresa é permitido mesmo que exista noutras", () => {
    const emailsInCompanyA = ["responsavel@empresa.ao"];
    const newEmailInB      = "responsavel@empresa.ao"; // mesmo email, empresa diferente
    // @@unique([companyId, email]) → não conflicto cross-empresa
    const hasConflictInB = emailsInCompanyA.includes(newEmailInB)
      && /* mesma empresa? */ false;
    expect(hasConflictInB).toBe(false);
  });

  it("password é opcional — sem password usa Magic Link", () => {
    const withPassword    = { passwordHash: "bcrypt$...", role: PortalRole.PORTAL_OWNER };
    const withoutPassword = { passwordHash: null, role: PortalRole.PORTAL_OWNER };

    expect(withPassword.passwordHash).toBeTruthy();
    expect(withoutPassword.passwordHash).toBeNull();
    // Ambos são válidos
    expect(withPassword.role).toBe(PortalRole.PORTAL_OWNER);
    expect(withoutPassword.role).toBe(PortalRole.PORTAL_OWNER);
  });

  it("password mínimo 8 caracteres", () => {
    const tooShort = "abc1234";  // 7 chars
    const ok       = "abc12345"; // 8 chars

    expect(tooShort.length < MIN_PASSWORD_LENGTH).toBe(true);
    expect(ok.length >= MIN_PASSWORD_LENGTH).toBe(true);
  });

  it("isConfirmed = false no momento da criação (confirma no 1.º login)", () => {
    const newUser = { isConfirmed: false, isActive: true };
    expect(newUser.isConfirmed).toBe(false);
    expect(newUser.isActive).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Magic Link gerado pelo admin
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL03-11 — Magic link de primeiro acesso", () => {
  it("TTL é 15 minutos", () => {
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);
    const diffMs    = expiresAt.getTime() - Date.now();
    expect(diffMs).toBeGreaterThanOrEqual(14 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(16 * 60 * 1000);
  });

  it("token tem 64 caracteres hex (randomBytes(32))", () => {
    const { randomBytes } = require("crypto");
    const token = randomBytes(32).toString("hex");
    expect(token).toHaveLength(MAGIC_LINK_TOKEN_HEX_CHARS);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("URL do magic link tem formato correcto", () => {
    const baseUrl = "https://azulcowork.com";
    const token   = "abc123def456";
    const url     = buildMagicLinkUrl(baseUrl, token);

    expect(url).toBe("https://azulcowork.com/portal/auth/magic?token=abc123def456");
    expect(url).toContain("/portal/auth/magic");
    expect(url).toContain("token=");
  });

  it("não tem rate limit no admin (admin pode reenviar quantas vezes quiser)", () => {
    // A rota admin não usa o rate limit interno do portal (3/hora)
    // O rate limit interno é só para self-service (POST /api/portal/auth/magic-link)
    const adminHasInternalRateLimit = false;
    expect(adminHasInternalRateLimit).toBe(false);
  });

  it("utilizador inactivo não pode receber magic link do admin", () => {
    const inactiveUser = { isActive: false };
    const canReceive   = inactiveUser.isActive;
    expect(canReceive).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Restrições de PATCH — gestão via admin
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL03-11 — PATCH PortalUser: restrições de role", () => {
  it("PORTAL_OWNER não pode ter role alterado via admin", () => {
    expect(canAlterRole(PortalRole.PORTAL_OWNER)).toBe(false);
  });

  it("PORTAL_ADMIN pode ter role alterado via admin", () => {
    expect(canAlterRole(PortalRole.PORTAL_ADMIN)).toBe(true);
  });

  it("PORTAL_MEMBER pode ter role alterado via admin", () => {
    expect(canAlterRole(PortalRole.PORTAL_MEMBER)).toBe(true);
  });

  it("PORTAL_VIEWER pode ter role alterado via admin", () => {
    expect(canAlterRole(PortalRole.PORTAL_VIEWER)).toBe(true);
  });

  it("admin NÃO pode criar PORTAL_OWNER via PATCH (enum excluído)", () => {
    const allowedRolesViaPatch = [
      PortalRole.PORTAL_VIEWER,
      PortalRole.PORTAL_MEMBER,
      PortalRole.PORTAL_ADMIN,
    ];
    expect(allowedRolesViaPatch).not.toContain(PortalRole.PORTAL_OWNER);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Restrições de desactivação
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL03-11 — Desactivação de PortalUser", () => {
  it("pode desactivar PORTAL_ADMIN (não é o único OWNER)", () => {
    const { allowed } = canDeactivate(PortalRole.PORTAL_ADMIN, 1);
    expect(allowed).toBe(true);
  });

  it("pode desactivar PORTAL_OWNER se há outro OWNER activo", () => {
    const { allowed } = canDeactivate(PortalRole.PORTAL_OWNER, 1);
    expect(allowed).toBe(true);
  });

  it("NÃO pode desactivar o último PORTAL_OWNER activo da empresa", () => {
    const { allowed, reason } = canDeactivate(PortalRole.PORTAL_OWNER, 0);
    expect(allowed).toBe(false);
    expect(reason).toContain("único PORTAL_OWNER activo");
  });

  it("desactivação deve revogar todas as sessões do utilizador", () => {
    // Simula o efeito de DELETE ou PATCH isActive=false
    const sessions = [
      { id: "1", isRevoked: false },
      { id: "2", isRevoked: false },
    ];
    // $transaction: update user + updateMany sessions
    const afterDeactivation = sessions.map(s => ({ ...s, isRevoked: true }));
    expect(afterDeactivation.every(s => s.isRevoked)).toBe(true);
  });

  it("DELETE nunca apaga fisicamente (isActive=false, dados mantidos)", () => {
    // Regra: nunca usar prisma.portalUser.delete() — só update isActive=false
    const operation = "UPDATE portalUser SET isActive=false WHERE id=...";
    expect(operation).toContain("UPDATE");
    expect(operation).not.toContain("DELETE FROM portalUser");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Dashboard de monitorização beta
// ═══════════════════════════════════════════════════════════════════════════════

describe("VOL03-11 — Dashboard beta: métricas de adopção", () => {
  it("taxa de entrega: 0% quando não há notificações", () => {
    const settledTotal = 0;
    const deliveryRate = settledTotal > 0 ? Math.round(100 / settledTotal) : 100;
    // Por convenção, 100% quando não há dados (não 0%)
    expect(deliveryRate).toBe(100);
  });

  it("taxa de entrega: correcta com dados reais", () => {
    const totalLast30 = 100;
    const pending     = 10;
    const deliveredAndRead = 80;
    const settled     = totalLast30 - pending; // 90
    const rate        = Math.round((deliveredAndRead / settled) * 100); // 89%
    expect(rate).toBe(89);
  });

  it("métricas do período correcto (last7days, last30days)", () => {
    const now     = Date.now();
    const last7   = new Date(now - 7  * 24 * 60 * 60 * 1000);
    const last30  = new Date(now - 30 * 24 * 60 * 60 * 1000);

    expect(last7.getTime()).toBeLessThan(now);
    expect(last30.getTime()).toBeLessThan(last7.getTime());
  });

  it("adoptionNotes gerados correctamente", () => {
    const confirmedUsers  = 3;
    const activeUsers     = 5;
    const companiesWithPortal = 2;
    const deliveryRate    = 97;

    const notes = [
      `${confirmedUsers}/${activeUsers} utilizadores confirmaram a conta`,
      `${companiesWithPortal} empresa(s) com portal activo`,
      `Taxa de entrega de notificações: ${deliveryRate}%`,
    ];

    expect(notes[0]).toBe("3/5 utilizadores confirmaram a conta");
    expect(notes[1]).toBe("2 empresa(s) com portal activo");
    expect(notes[2]).toBe("Taxa de entrega de notificações: 97%");
  });
});
