/**
 * communication-service.test.ts — VOL07-4
 *
 * Testa a lógica de communication-service:
 *   - sendEmail com SMTP não configurado (graceful degradation)
 *   - sendEmail com template não encontrado (fallback)
 *   - retryFailedEmails com SMTP não configurado (retorna zeros)
 *   - buildDeepLink (pure function do whatsapp-service)
 *   - logWhatsAppDeepLink cria log com status SENT
 *
 * Nota: este módulo faz I/O (Prisma + SMTP). Testamos com mocks.
 * Critério de DoD: ≥ 8 assertions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockLogCreate  = vi.fn();
const mockLogUpdate  = vi.fn();
const mockLogFindMany = vi.fn();
const mockTplFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    communicationLog: {
      create:   (...args: unknown[]) => mockLogCreate(...args),
      update:   (...args: unknown[]) => mockLogUpdate(...args),
      findMany: (...args: unknown[]) => mockLogFindMany(...args),
    },
    emailTemplate: {
      findUnique: (...args: unknown[]) => mockTplFindUnique(...args),
    },
  },
}));

// ── Mock nodemailer ───────────────────────────────────────────────────────────

const mockSendMail = vi.fn();

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: mockSendMail }),
  },
}));

// ── Importações após mocks ────────────────────────────────────────────────────

import { sendEmail, retryFailedEmails } from "@/lib/communication-service";
import { buildDeepLink, sendWhatsApp }   from "@/lib/whatsapp-service";
import { logWhatsAppDeepLink }           from "@/lib/communication-service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockLog(id = "log-001") {
  mockLogCreate.mockResolvedValue({ id });
  mockLogUpdate.mockResolvedValue({ id });
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe("sendEmail — SMTP não configurado", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
    mockLog();
    mockTplFindUnique.mockResolvedValue(null);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("retorna success=false quando SMTP não configurado", async () => {
    const result = await sendEmail({
      to:      "cliente@empresa.ao",
      subject: "Teste",
      html:    "<p>Olá</p>",
      channel: "transactional",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/SMTP/i);
  });

  it("cria CommunicationLog com status FAILED", async () => {
    await sendEmail({
      to:      "a@b.ao",
      subject: "X",
      html:    "<p>X</p>",
      channel: "alert",
    });
    // create inicial (PENDING) + update (FAILED)
    expect(mockLogCreate).toHaveBeenCalledTimes(1);
    expect(mockLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );
  });

  it("retorna logId válido mesmo em falha", async () => {
    const result = await sendEmail({
      to:      "x@y.ao",
      subject: "S",
      html:    "<b>H</b>",
      channel: "reminder",
    });
    expect(typeof result.logId).toBe("string");
    expect(result.logId.length).toBeGreaterThan(0);
  });
});

describe("sendEmail — template fallback", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_USER", "smtp@test.ao");
    vi.stubEnv("SMTP_PASS", "secret");
    mockLog();
    // Template não encontrado
    mockTplFindUnique.mockResolvedValue(null);
    // SMTP sucesso
    mockSendMail.mockResolvedValue({ messageId: "msg-001" });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("usa subject/html do caller quando template não existe", async () => {
    const result = await sendEmail({
      templateSlug: "inexistente",
      to:           "c@d.ao",
      subject:      "Fallback Subject",
      html:         "<p>Fallback</p>",
      channel:      "transactional",
    });
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Fallback Subject" })
    );
  });

  it("cria log com status SENT em caso de sucesso", async () => {
    await sendEmail({
      to:      "e@f.ao",
      subject: "OK",
      html:    "<p>OK</p>",
      channel: "receipt",
    });
    expect(mockLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SENT" }) })
    );
  });
});

describe("retryFailedEmails", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("retorna zeros quando SMTP não configurado", async () => {
    const result = await retryFailedEmails();
    expect(result.retried).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.stillFailing).toBe(0);
  });
});

describe("logWhatsAppDeepLink", () => {
  beforeEach(() => {
    mockLogCreate.mockResolvedValue({ id: "wa-log-001" });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cria log com type WHATSAPP_DEEPLINK e status SENT", async () => {
    const logId = await logWhatsAppDeepLink({
      to:      "244923000000",
      body:    "Olá! A sua reserva foi confirmada.",
      channel: "transactional",
    });
    expect(typeof logId).toBe("string");
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type:   "WHATSAPP_DEEPLINK",
          status: "SENT",
        }),
      })
    );
  });
});

// ── buildDeepLink (pure function) ─────────────────────────────────────────────

describe("buildDeepLink", () => {
  it("gera URL wa.me correctamente", () => {
    const url = buildDeepLink("244923000000", "Olá!");
    expect(url).toMatch(/^https:\/\/wa\.me\/244923000000/);
    expect(url).toContain(encodeURIComponent("Olá!"));
  });

  it("normaliza número com hífens e espaços", () => {
    const url = buildDeepLink("+244 923-000-000", "Teste");
    expect(url).toContain("244923000000");
  });

  it("encode texto com caracteres especiais", () => {
    const url = buildDeepLink("244923000000", "Reserva #001 — Azul Coworking");
    expect(url).toContain("%23");
  });
});
