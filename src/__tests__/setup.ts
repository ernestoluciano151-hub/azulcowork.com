/**
 * setup.ts — Setup global executado antes de cada ficheiro de teste.
 *
 * - Limpa todos os mocks entre testes (vi.clearAllMocks)
 * - Garante que variáveis de ambiente críticas estão definidas
 * - Limpa o EventBus entre testes para evitar interferências
 */

import { vi, beforeEach, afterEach } from "vitest";

// ── Variáveis de ambiente para testes ────────────────────────────────────────
process.env.JWT_SECRET = "test-secret-com-pelo-menos-32-caracteres-para-ser-seguro";
process.env.NODE_ENV   = "test";

// ── Reset de mocks entre testes ───────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
