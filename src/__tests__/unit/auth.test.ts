/**
 * auth.test.ts — Testes unitários de src/lib/auth.ts
 *
 * Estratégia: vitest.config.ts define aliases estáticos para
 * "next/headers" e "next/server" → mocks em src/__tests__/helpers/next-mocks/.
 * jose é mockado via vi.mock para controlar o resultado de jwtVerify.
 *
 * Padrão: Deny by Default — qualquer falha retorna 401 ou 403.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminRole } from "@prisma/client";

// ── Mock de jose ANTES de qualquer import de auth ────────────────────────────
vi.mock("jose", () => ({
  SignJWT: vi.fn().mockReturnValue({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt:        vi.fn().mockReturnThis(),
    setExpirationTime:  vi.fn().mockReturnThis(),
    sign:               vi.fn().mockResolvedValue("mock-token"),
  }),
  jwtVerify: vi.fn(),
}));

// Imports após mocks
import { requireSession, requireRole } from "@/lib/auth";
import { cookies }    from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify }  from "jose";
import { sessions }   from "@/__tests__/helpers/fixtures";

// ── Helpers de controlo de sessão ─────────────────────────────────────────────
function mockSession(payload: Record<string, unknown> | null) {
  const cookieVal = payload ? "mock-token" : undefined;

  // Forçar cookies() a devolver ou não o token
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn((_name: string) =>
      cookieVal ? { name: "vd_admin_session", value: cookieVal } : undefined
    ),
    set: vi.fn(),
    delete: vi.fn(),
  } as any);

  // Forçar jwtVerify a devolver payload ou lançar erro
  if (payload) {
    vi.mocked(jwtVerify).mockResolvedValue({ payload } as any);
  } else {
    vi.mocked(jwtVerify).mockRejectedValue(new Error("no token"));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  // NextResponse.json retorna objecto simples (definido no mock estático)
  // Mas como NextResponse.json é vi.fn(), podemos verificar as chamadas
});

// ─────────────────────────────────────────────
// requireSession
// ─────────────────────────────────────────────
describe("requireSession", () => {
  it("retorna 401 quando não existe sessão", async () => {
    mockSession(null);
    const result = await requireSession();

    expect(result.session).toBeNull();
    expect(result.error).not.toBeNull();
    expect(vi.mocked(NextResponse.json)).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
      { status: 401 }
    );
  });

  it("retorna sessão válida quando cookie e token existem", async () => {
    mockSession(sessions.admin);
    const result = await requireSession();

    expect(result.error).toBeNull();
    expect(result.session).not.toBeNull();
    expect(result.session?.email).toBe("admin@azulcowork.com");
  });

  it("retorna sessão com role correcto", async () => {
    mockSession(sessions.financeiro);
    const result = await requireSession();

    expect(result.session?.role).toBe(AdminRole.FINANCEIRO);
  });

  it("retorna 401 quando token é inválido (jwtVerify lança)", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn(() => ({ name: "vd_admin_session", value: "bad-token" })),
      set: vi.fn(),
      delete: vi.fn(),
    } as any);
    vi.mocked(jwtVerify).mockRejectedValue(new Error("invalid signature"));

    const result = await requireSession();
    expect(result.session).toBeNull();
    expect(result.error).not.toBeNull();
  });
});

// ─────────────────────────────────────────────
// requireRole
// ─────────────────────────────────────────────
describe("requireRole", () => {
  it("retorna 401 quando não existe sessão", async () => {
    mockSession(null);
    const result = await requireRole(AdminRole.ADMIN);

    expect(result.session).toBeNull();
    expect(vi.mocked(NextResponse.json)).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
      { status: 401 }
    );
  });

  it("retorna 403 quando role não está na allowlist (VIEWER vs ADMIN)", async () => {
    mockSession(sessions.viewer);
    const result = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);

    expect(result.session).toBeNull();
    expect(vi.mocked(NextResponse.json)).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
      { status: 403 }
    );
  });

  it("retorna 403 quando sessão não tem role", async () => {
    mockSession({ sub: "x", email: "x@x.ao" }); // sem campo role
    const result = await requireRole(AdminRole.ADMIN);

    expect(result.session).toBeNull();
    expect(vi.mocked(NextResponse.json)).toHaveBeenCalledWith(
      expect.anything(),
      { status: 403 }
    );
  });

  it("ADMIN tem acesso quando ADMIN está na allowlist", async () => {
    mockSession(sessions.admin);
    const result = await requireRole(AdminRole.ADMIN);

    expect(result.error).toBeNull();
    expect(result.session?.role).toBe(AdminRole.ADMIN);
  });

  it("COMERCIAL tem acesso quando está na allowlist multi-role", async () => {
    mockSession(sessions.comercial);
    const result = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO);

    expect(result.error).toBeNull();
    expect(result.session?.role).toBe(AdminRole.COMERCIAL);
  });

  it("FINANCEIRO tem acesso quando está na allowlist", async () => {
    mockSession(sessions.financeiro);
    const result = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);

    expect(result.error).toBeNull();
  });

  it("VIEWER é bloqueado em rotas ADMIN+FINANCEIRO", async () => {
    mockSession(sessions.viewer);
    const result = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);

    expect(result.error).not.toBeNull();
    expect(result.session).toBeNull();
  });

  it("COMERCIAL é bloqueado em rota só para ADMIN", async () => {
    mockSession(sessions.comercial);
    const result = await requireRole(AdminRole.ADMIN);

    expect(result.error).not.toBeNull();
  });

  it("devolve sessão completa com sub e name quando autorizado", async () => {
    mockSession(sessions.admin);
    const result = await requireRole(AdminRole.ADMIN);

    expect(result.session?.sub).toBe("usr-001");
    expect(result.session?.name).toBe("Admin Azul");
  });

  it("Deny by Default: lista vazia bloqueia mesmo ADMIN", async () => {
    mockSession(sessions.admin);
    const result = await requireRole(); // nenhum role permitido

    expect(result.session).toBeNull();
    expect(result.error).not.toBeNull();
  });
});
