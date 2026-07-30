/**
 * audit-service.test.ts — VOL05-4
 *
 * Testa: sanitizeForAudit, actorFromSession, SYSTEM_ACTOR, UNKNOWN_ACTOR
 * recordAudit é testado com mock do Prisma (chamada a auditLog.create)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sanitizeForAudit,
  actorFromSession,
  SYSTEM_ACTOR,
  UNKNOWN_ACTOR,
  recordAudit,
} from "@/lib/audit-service";

// ── Mock Prisma ───────────────────────────────────────────────────────────────
const mockCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

// ── sanitizeForAudit ──────────────────────────────────────────────────────────
describe("sanitizeForAudit", () => {
  it("remove passwordHash", () => {
    const result = sanitizeForAudit({ id: "1", email: "a@b.com", passwordHash: "hash123" });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).toHaveProperty("id", "1");
    expect(result).toHaveProperty("email", "a@b.com");
  });

  it("remove totpSecret", () => {
    const result = sanitizeForAudit({ id: "1", totpSecret: "SECRET", active: true });
    expect(result).not.toHaveProperty("totpSecret");
    expect(result).toHaveProperty("active", true);
  });

  it("remove tokenHash", () => {
    const result = sanitizeForAudit({ tokenHash: "abc123", ipAddress: "127.0.0.1" });
    expect(result).not.toHaveProperty("tokenHash");
    expect(result).toHaveProperty("ipAddress", "127.0.0.1");
  });

  it("remove token, password, secret, refreshToken", () => {
    const input = {
      id: "x",
      token: "tok",
      password: "pw",
      secret: "s",
      refreshToken: "rt",
      name: "Alice",
    };
    const result = sanitizeForAudit(input);
    expect(result).not.toHaveProperty("token");
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("secret");
    expect(result).not.toHaveProperty("refreshToken");
    expect(result).toHaveProperty("id", "x");
    expect(result).toHaveProperty("name", "Alice");
  });

  it("retorna objecto vazio para input vazio", () => {
    expect(sanitizeForAudit({})).toEqual({});
  });

  it("não modifica objectos sem campos sensíveis", () => {
    const input = { id: "1", role: "ADMIN", email: "x@y.com" };
    const result = sanitizeForAudit(input);
    expect(result).toEqual(input);
  });
});

// ── actorFromSession ──────────────────────────────────────────────────────────
describe("actorFromSession", () => {
  it("constrói AuditActor com role presente", () => {
    const actor = actorFromSession({ sub: "u1", email: "admin@azul.com", role: "ADMIN" });
    expect(actor).toEqual({ id: "u1", role: "ADMIN", email: "admin@azul.com" });
  });

  it("usa UNKNOWN quando role não está presente", () => {
    const actor = actorFromSession({ sub: "u2", email: "user@azul.com" });
    expect(actor.role).toBe("UNKNOWN");
  });
});

// ── SYSTEM_ACTOR e UNKNOWN_ACTOR ──────────────────────────────────────────────
describe("actors predefinidos", () => {
  it("SYSTEM_ACTOR tem id SYSTEM", () => {
    expect(SYSTEM_ACTOR.id).toBe("SYSTEM");
    expect(SYSTEM_ACTOR.role).toBe("SYSTEM");
  });

  it("UNKNOWN_ACTOR tem id UNKNOWN", () => {
    expect(UNKNOWN_ACTOR.id).toBe("UNKNOWN");
    expect(UNKNOWN_ACTOR.role).toBe("UNKNOWN");
  });
});

// ── recordAudit ───────────────────────────────────────────────────────────────
describe("recordAudit", () => {
  beforeEach(() => { mockCreate.mockClear(); });

  it("chama prisma.auditLog.create com os campos correctos", async () => {
    await recordAudit({
      actor:    { id: "u1", role: "ADMIN", email: "admin@azul.com" },
      action:   "PAYMENT_CREATED",
      entity:   "Payment",
      entityId: "pay-001",
      entityRef: "REC-2026-000001",
      after:    { amount: 50000, status: "PAGO" },
      ipAddress: "1.2.3.4",
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0][0];
    expect(call.data.actorId).toBe("u1");
    expect(call.data.action).toBe("PAYMENT_CREATED");
    expect(call.data.entity).toBe("Payment");
    expect(call.data.entityId).toBe("pay-001");
    expect(call.data.entityRef).toBe("REC-2026-000001");
    expect(call.data.ipAddress).toBe("1.2.3.4");
  });

  it("sanitiza before/after internamente (remoção de passwordHash)", async () => {
    await recordAudit({
      actor:    SYSTEM_ACTOR,
      action:   "ADMIN_USER_UPDATED",
      entity:   "AdminUser",
      entityId: "u1",
      before:   { email: "x@y.com", passwordHash: "SHOULD_BE_REMOVED" },
      after:    { email: "new@y.com", passwordHash: "ALSO_REMOVED" },
    });

    const call = mockCreate.mock.calls[0][0];
    expect(call.data.before).not.toHaveProperty("passwordHash");
    expect(call.data.after).not.toHaveProperty("passwordHash");
    expect(call.data.before).toHaveProperty("email", "x@y.com");
  });

  it("aceita before/after undefined sem erro", async () => {
    await recordAudit({
      actor:    UNKNOWN_ACTOR,
      action:   "LOGIN_FAILED",
      entity:   "AdminUser",
      entityId: "UNKNOWN",
    });

    const call = mockCreate.mock.calls[0][0];
    expect(call.data.before).toBeUndefined();
    expect(call.data.after).toBeUndefined();
  });

  it("metadata é passada sem sanitização", async () => {
    await recordAudit({
      actor:    SYSTEM_ACTOR,
      action:   "LOGIN_FAILED",
      entity:   "AdminUser",
      entityId: "UNKNOWN",
      metadata: { reason: "USER_NOT_FOUND", attempts: 3 },
    });

    const call = mockCreate.mock.calls[0][0];
    expect(call.data.metadata).toEqual({ reason: "USER_NOT_FOUND", attempts: 3 });
  });
});
