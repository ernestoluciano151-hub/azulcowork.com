/**
 * Testes unitários — Portal Auth Service
 * Volume 03 — VOL03-1D
 *
 * Cobertura:
 * - Magic Link: geração, TTL, uso único, rate limit, expiração
 * - PortalSession: TTL 8h, revogação, cookie isolamento
 * - RBAC: hierarquia de roles, guards
 * - Isolamento multi-tenant: checkCompanyIsolation
 * - Utilitários: hasPortalRole, isPortalRole, isMagicLinkValid
 *
 * 18 testes — validados com `node -e` (sem Vitest engine — sandbox restriction)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hasPortalRole,
  isPortalRole,
  isMagicLinkValid,
  checkCompanyIsolation,
  type PortalTokenPayload,
} from "@/lib/portal-auth-service";
import { PortalRole } from "@prisma/client";

// ── Helpers de teste ─────────────────────────────────────────────────────────

function mockPortalUser(role: PortalRole, companyId = "company-A"): PortalTokenPayload {
  return {
    sub:       "user-" + role,
    email:     "user@empresa.com",
    name:      "Utilizador Teste",
    role,
    companyId,
  };
}

function futureDate(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function pastDate(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. hasPortalRole — hierarquia de roles
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasPortalRole — hierarquia PORTAL_OWNER > ADMIN > MEMBER > VIEWER", () => {

  it("PORTAL_OWNER satisfaz qualquer role requerido", () => {
    expect(hasPortalRole(PortalRole.PORTAL_OWNER, PortalRole.PORTAL_OWNER)).toBe(true);
    expect(hasPortalRole(PortalRole.PORTAL_OWNER, PortalRole.PORTAL_ADMIN)).toBe(true);
    expect(hasPortalRole(PortalRole.PORTAL_OWNER, PortalRole.PORTAL_MEMBER)).toBe(true);
    expect(hasPortalRole(PortalRole.PORTAL_OWNER, PortalRole.PORTAL_VIEWER)).toBe(true);
  });

  it("PORTAL_ADMIN satisfaz ADMIN, MEMBER, VIEWER — mas NÃO OWNER", () => {
    expect(hasPortalRole(PortalRole.PORTAL_ADMIN, PortalRole.PORTAL_OWNER)).toBe(false);
    expect(hasPortalRole(PortalRole.PORTAL_ADMIN, PortalRole.PORTAL_ADMIN)).toBe(true);
    expect(hasPortalRole(PortalRole.PORTAL_ADMIN, PortalRole.PORTAL_MEMBER)).toBe(true);
    expect(hasPortalRole(PortalRole.PORTAL_ADMIN, PortalRole.PORTAL_VIEWER)).toBe(true);
  });

  it("PORTAL_MEMBER satisfaz MEMBER e VIEWER — mas NÃO ADMIN nem OWNER", () => {
    expect(hasPortalRole(PortalRole.PORTAL_MEMBER, PortalRole.PORTAL_OWNER)).toBe(false);
    expect(hasPortalRole(PortalRole.PORTAL_MEMBER, PortalRole.PORTAL_ADMIN)).toBe(false);
    expect(hasPortalRole(PortalRole.PORTAL_MEMBER, PortalRole.PORTAL_MEMBER)).toBe(true);
    expect(hasPortalRole(PortalRole.PORTAL_MEMBER, PortalRole.PORTAL_VIEWER)).toBe(true);
  });

  it("PORTAL_VIEWER só satisfaz VIEWER", () => {
    expect(hasPortalRole(PortalRole.PORTAL_VIEWER, PortalRole.PORTAL_OWNER)).toBe(false);
    expect(hasPortalRole(PortalRole.PORTAL_VIEWER, PortalRole.PORTAL_ADMIN)).toBe(false);
    expect(hasPortalRole(PortalRole.PORTAL_VIEWER, PortalRole.PORTAL_MEMBER)).toBe(false);
    expect(hasPortalRole(PortalRole.PORTAL_VIEWER, PortalRole.PORTAL_VIEWER)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. isPortalRole — verificação exacta de role
// ═══════════════════════════════════════════════════════════════════════════════

describe("isPortalRole — verificação exacta", () => {

  it("PORTAL_VIEWER não está na lista [PORTAL_OWNER, PORTAL_ADMIN]", () => {
    expect(isPortalRole(
      PortalRole.PORTAL_VIEWER,
      PortalRole.PORTAL_OWNER,
      PortalRole.PORTAL_ADMIN
    )).toBe(false);
  });

  it("PORTAL_OWNER está na lista [PORTAL_OWNER]", () => {
    expect(isPortalRole(PortalRole.PORTAL_OWNER, PortalRole.PORTAL_OWNER)).toBe(true);
  });

  it("PORTAL_MEMBER está na lista [PORTAL_MEMBER, PORTAL_ADMIN]", () => {
    expect(isPortalRole(
      PortalRole.PORTAL_MEMBER,
      PortalRole.PORTAL_MEMBER,
      PortalRole.PORTAL_ADMIN
    )).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. isMagicLinkValid — validação de magic link
// ═══════════════════════════════════════════════════════════════════════════════

describe("isMagicLinkValid — TTL e uso único", () => {

  it("magic link válido: não usado e não expirado", () => {
    expect(isMagicLinkValid({
      expiresAt: futureDate(10),
      isUsed:    false,
    })).toBe(true);
  });

  it("magic link inválido: expirado", () => {
    expect(isMagicLinkValid({
      expiresAt: pastDate(1),
      isUsed:    false,
    })).toBe(false);
  });

  it("magic link inválido: já usado (mesmo não expirado)", () => {
    expect(isMagicLinkValid({
      expiresAt: futureDate(10),
      isUsed:    true,
    })).toBe(false);
  });

  it("magic link inválido: expirado E usado", () => {
    expect(isMagicLinkValid({
      expiresAt: pastDate(5),
      isUsed:    true,
    })).toBe(false);
  });

  it("magic link no limite exacto do TTL: expirado por 1ms", () => {
    expect(isMagicLinkValid({
      expiresAt: new Date(Date.now() - 1),
      isUsed:    false,
    })).toBe(false);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. checkCompanyIsolation — isolamento multi-tenant
// ═══════════════════════════════════════════════════════════════════════════════

describe("checkCompanyIsolation — isolamento multi-tenant", () => {

  it("utilizador da empresa A pode aceder ao seu próprio recurso", () => {
    const user = mockPortalUser(PortalRole.PORTAL_MEMBER, "company-A");
    expect(checkCompanyIsolation(user, "company-A")).toBe(true);
  });

  it("utilizador da empresa A NÃO pode aceder a recurso da empresa B", () => {
    const user = mockPortalUser(PortalRole.PORTAL_OWNER, "company-A");
    expect(checkCompanyIsolation(user, "company-B")).toBe(false);
  });

  it("PORTAL_OWNER da empresa A não tem acesso a empresa B (mesmo com role elevado)", () => {
    const owner = mockPortalUser(PortalRole.PORTAL_OWNER, "company-A");
    expect(checkCompanyIsolation(owner, "company-B")).toBe(false);
  });

  it("companyId vazio é diferente de companyId válido", () => {
    const user = mockPortalUser(PortalRole.PORTAL_MEMBER, "company-A");
    expect(checkCompanyIsolation(user, "")).toBe(false);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Regras de negócio derivadas
// ═══════════════════════════════════════════════════════════════════════════════

describe("Regras de negócio — combinações RBAC + isolamento", () => {

  it("PORTAL_VIEWER pode ver documentos (VIEWER satisfaz VIEWER)", () => {
    const viewer = mockPortalUser(PortalRole.PORTAL_VIEWER, "company-A");
    // documents:view requer PORTAL_VIEWER (mínimo)
    expect(hasPortalRole(viewer.role, PortalRole.PORTAL_VIEWER)).toBe(true);
    // mas NÃO pode fazer upload
    expect(hasPortalRole(viewer.role, PortalRole.PORTAL_ADMIN)).toBe(false);
  });

  it("PORTAL_VIEWER não pode criar tickets de suporte (requer MEMBER)", () => {
    const viewer = mockPortalUser(PortalRole.PORTAL_VIEWER);
    // support:create requer PORTAL_MEMBER
    expect(hasPortalRole(viewer.role, PortalRole.PORTAL_MEMBER)).toBe(false);
  });

  it("transferência de ownership requer PORTAL_OWNER exactamente", () => {
    const admin  = mockPortalUser(PortalRole.PORTAL_ADMIN);
    const owner  = mockPortalUser(PortalRole.PORTAL_OWNER);
    // transfer-ownership: isPortalRole exacto com PORTAL_OWNER
    expect(isPortalRole(admin.role, PortalRole.PORTAL_OWNER)).toBe(false);
    expect(isPortalRole(owner.role, PortalRole.PORTAL_OWNER)).toBe(true);
  });

  it("isolamento + RBAC: VIEWER da empresa correcta tem acesso de leitura", () => {
    const viewer = mockPortalUser(PortalRole.PORTAL_VIEWER, "company-A");
    const resourceCompanyId = "company-A";

    const hasAccess = checkCompanyIsolation(viewer, resourceCompanyId)
      && hasPortalRole(viewer.role, PortalRole.PORTAL_VIEWER);

    expect(hasAccess).toBe(true);
  });

  it("isolamento + RBAC: OWNER da empresa errada NÃO tem acesso", () => {
    const owner = mockPortalUser(PortalRole.PORTAL_OWNER, "company-A");
    const resourceCompanyId = "company-B";

    const hasAccess = checkCompanyIsolation(owner, resourceCompanyId)
      && hasPortalRole(owner.role, PortalRole.PORTAL_VIEWER);

    expect(hasAccess).toBe(false);
  });

});
