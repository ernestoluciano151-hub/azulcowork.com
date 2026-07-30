/**
 * rateLimit.test.ts — Testes unitários de src/lib/rateLimit.ts
 *
 * Nota: as stores são singletons em memória. Para isolar testes que
 * dependem de estado, usamos IPs únicos por cenário.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRateLimited, isLoginRateLimited, looksLikeBot } from "@/lib/rateLimit";

// ─────────────────────────────────────────────
// isRateLimited (leads — limite: 5 hits / 10 min)
// ─────────────────────────────────────────────
describe("isRateLimited (leads)", () => {
  it("não bloqueia nas primeiras 5 chamadas", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(ip)).toBe(false);
    }
  });

  it("bloqueia na 6.ª chamada dentro da janela", () => {
    const ip = "10.0.0.2";
    for (let i = 0; i < 5; i++) isRateLimited(ip);
    expect(isRateLimited(ip)).toBe(true);
  });

  it("continua a bloquear após exceder limite", () => {
    const ip = "10.0.0.3";
    for (let i = 0; i < 10; i++) isRateLimited(ip);
    expect(isRateLimited(ip)).toBe(true);
  });

  it("IPs diferentes têm contadores independentes", () => {
    const ip1 = "192.168.1.1";
    const ip2 = "192.168.1.2";
    for (let i = 0; i < 6; i++) isRateLimited(ip1);
    // ip2 não foi chamado, não deve estar bloqueado
    expect(isRateLimited(ip2)).toBe(false);
  });

  it("reinicia contador após expirar a janela temporal", () => {
    const ip = "10.0.1.1";
    // Simular 6 hits (bloqueia)
    for (let i = 0; i < 6; i++) isRateLimited(ip);
    expect(isRateLimited(ip)).toBe(true);

    // Avançar o relógio 11 minutos (> LEAD_WINDOW_MS = 10 min)
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    expect(isRateLimited(ip)).toBe(false);
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────
// isLoginRateLimited (login — limite: 10 hits / 15 min)
// ─────────────────────────────────────────────
describe("isLoginRateLimited", () => {
  it("não bloqueia nas primeiras 10 tentativas", () => {
    const ip = "10.1.0.1";
    for (let i = 0; i < 10; i++) {
      expect(isLoginRateLimited(ip)).toBe(false);
    }
  });

  it("bloqueia na 11.ª tentativa", () => {
    const ip = "10.1.0.2";
    for (let i = 0; i < 10; i++) isLoginRateLimited(ip);
    expect(isLoginRateLimited(ip)).toBe(true);
  });

  it("tem janela independente do rate limit de leads", () => {
    const ip = "10.1.0.3";
    // Esgotar limite de leads
    for (let i = 0; i < 6; i++) isRateLimited(ip);
    // Login ainda não atingiu limite
    expect(isLoginRateLimited(ip)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// looksLikeBot
// ─────────────────────────────────────────────
describe("looksLikeBot", () => {
  it("detecta honeypot preenchido", () => {
    const formStartedAt = Date.now() - 5000; // 5 segundos atrás
    expect(looksLikeBot(formStartedAt, "bot@spam.com")).toBe(true);
  });

  it("não detecta bot com honeypot vazio e tempo suficiente", () => {
    const formStartedAt = Date.now() - 5000;
    expect(looksLikeBot(formStartedAt, "")).toBe(false);
  });

  it("detecta submissão demasiado rápida (< 1.5s)", () => {
    const formStartedAt = Date.now() - 500; // 0.5 segundos atrás
    expect(looksLikeBot(formStartedAt, "")).toBe(true);
  });

  it("não detecta bot com 2 segundos de preenchimento e honeypot vazio", () => {
    const formStartedAt = Date.now() - 2000;
    expect(looksLikeBot(formStartedAt, "")).toBe(false);
  });

  it("detecta bot mesmo com honeypot só de espaços", () => {
    const formStartedAt = Date.now() - 5000;
    expect(looksLikeBot(formStartedAt, "   ")).toBe(false); // trim → empty
  });

  it("detecta honeypot com conteúdo e submissão rápida (dupla detecção)", () => {
    const formStartedAt = Date.now() - 100;
    expect(looksLikeBot(formStartedAt, "bot")).toBe(true);
  });
});
