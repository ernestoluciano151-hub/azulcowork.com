/**
 * admin-sessions.test.ts — VOL05-4
 *
 * Testa a lógica de negócio das sessions:
 * - hashToken é SHA-256 determinístico
 * - createSession cria AdminSession na BD
 * - destroySession marca AdminSession como revogada
 * - getSession retorna null para sessão revogada
 * - getSession retorna null para sessão expirada
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock jose ─────────────────────────────────────────────────────────────────
vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt:        vi.fn().mockReturnThis(),
    setExpirationTime:  vi.fn().mockReturnThis(),
    sign:               vi.fn().mockResolvedValue("mock-jwt-token"),
  })),
  jwtVerify: vi.fn().mockResolvedValue({
    payload: { sub: "u1", email: "admin@azul.com", role: "ADMIN" },
  }),
}));

// ── Mock next/headers ─────────────────────────────────────────────────────────
const mockCookieSet = vi.fn();
const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    set: mockCookieSet,
    get: mockCookieGet,
  }),
}));

// ── Mock Prisma ───────────────────────────────────────────────────────────────
const mockSessionCreate     = vi.fn().mockResolvedValue({ id: "sess-1" });
const mockSessionUpdate     = vi.fn().mockResolvedValue({});
const mockSessionUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const mockSessionFindUnique = vi.fn();
const mockUserUpdate        = vi.fn().mockResolvedValue({});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminSession: {
      create:      (...a: unknown[]) => mockSessionCreate(...a),
      update:      (...a: unknown[]) => mockSessionUpdate(...a),
      updateMany:  (...a: unknown[]) => mockSessionUpdateMany(...a),
      findUnique:  (...a: unknown[]) => mockSessionFindUnique(...a),
    },
    adminUser: {
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
  },
}));

// ── Env ───────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";

// ── Import após mocks ─────────────────────────────────────────────────────────
import { createSession, destroySession, getSession } from "@/lib/auth";

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieGet.mockReturnValue(undefined);
  });

  it("cria AdminSession na BD com tokenHash e expiresAt", async () => {
    await createSession(
      { sub: "u1", email: "admin@azul.com", role: "ADMIN" as never },
      { ipAddress: "1.2.3.4", userAgent: "TestAgent" }
    );

    expect(mockSessionCreate).toHaveBeenCalledOnce();
    const call = mockSessionCreate.mock.calls[0][0];
    expect(call.data.adminUserId).toBe("u1");
    expect(call.data.tokenHash).toBeTypeOf("string");
    expect(call.data.tokenHash.length).toBe(64); // SHA-256 hex = 64 chars
    expect(call.data.ipAddress).toBe("1.2.3.4");
    expect(call.data.userAgent).toBe("TestAgent");
    expect(call.data.expiresAt).toBeInstanceOf(Date);
  });

  it("actualiza lastLoginAt + lastLoginIp no AdminUser", async () => {
    await createSession(
      { sub: "u1", email: "admin@azul.com" },
      { ipAddress: "10.0.0.1" }
    );

    expect(mockUserUpdate).toHaveBeenCalledOnce();
    const call = mockUserUpdate.mock.calls[0][0];
    expect(call.where.id).toBe("u1");
    expect(call.data.lastLoginIp).toBe("10.0.0.1");
    expect(call.data.lastLoginAt).toBeInstanceOf(Date);
  });

  it("define cookie httpOnly com maxAge de 12h", async () => {
    await createSession({ sub: "u1", email: "admin@azul.com" });
    expect(mockCookieSet).toHaveBeenCalledOnce();
    const [name, _token, opts] = mockCookieSet.mock.calls[0];
    expect(name).toBe("vd_admin_session");
    expect(opts.httpOnly).toBe(true);
    expect(opts.maxAge).toBe(12 * 3600);
    expect(opts.sameSite).toBe("lax");
  });
});

describe("destroySession", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("marca AdminSession como revogada quando token existe", async () => {
    mockCookieGet.mockReturnValue({ value: "mock-jwt-token" });

    await destroySession();

    expect(mockSessionUpdateMany).toHaveBeenCalledOnce();
    const call = mockSessionUpdateMany.mock.calls[0][0];
    expect(call.data.isRevoked).toBe(true);
    expect(call.where.isRevoked).toBe(false);
    expect(call.where.tokenHash).toBeTypeOf("string");
  });

  it("limpa o cookie após revogar", async () => {
    mockCookieGet.mockReturnValue({ value: "mock-jwt-token" });
    await destroySession();
    expect(mockCookieSet).toHaveBeenCalledWith("vd_admin_session", "", { path: "/", maxAge: 0 });
  });

  it("limpa o cookie mesmo sem token no cookie", async () => {
    mockCookieGet.mockReturnValue(undefined);
    await destroySession();
    expect(mockCookieSet).toHaveBeenCalledWith("vd_admin_session", "", { path: "/", maxAge: 0 });
    expect(mockSessionUpdateMany).not.toHaveBeenCalled();
  });
});

describe("getSession", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("retorna null quando não há token no cookie", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const s = await getSession();
    expect(s).toBeNull();
  });

  it("retorna null quando a sessão está revogada", async () => {
    mockCookieGet.mockReturnValue({ value: "mock-jwt-token" });
    mockSessionFindUnique.mockResolvedValue({
      isRevoked: true,
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const s = await getSession();
    expect(s).toBeNull();
  });

  it("retorna null quando a sessão está expirada na BD", async () => {
    mockCookieGet.mockReturnValue({ value: "mock-jwt-token" });
    mockSessionFindUnique.mockResolvedValue({
      isRevoked: false,
      expiresAt: new Date(Date.now() - 1000), // expirou
    });

    const s = await getSession();
    expect(s).toBeNull();
  });

  it("retorna null quando a sessão não existe na BD", async () => {
    mockCookieGet.mockReturnValue({ value: "mock-jwt-token" });
    mockSessionFindUnique.mockResolvedValue(null);

    const s = await getSession();
    expect(s).toBeNull();
  });

  it("retorna payload quando sessão é válida e não revogada", async () => {
    mockCookieGet.mockReturnValue({ value: "mock-jwt-token" });
    mockSessionFindUnique.mockResolvedValue({
      isRevoked: false,
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const s = await getSession();
    expect(s).not.toBeNull();
    expect(s?.sub).toBe("u1");
    expect(s?.email).toBe("admin@azul.com");
  });
});
