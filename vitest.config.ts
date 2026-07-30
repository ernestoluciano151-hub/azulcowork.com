/**
 * vitest.config.ts — Configuração de testes unitários VD Platform
 *
 * Âmbito: testes unitários de src/lib/*.ts
 * Excluído: ficheiros Next.js (pages, components, api routes que precisam de runtime Next)
 *
 * Executar:
 *   npm test               → suite completa (watch desligado)
 *   npm run test:watch     → modo interactivo
 *   npm run test:coverage  → relatório de cobertura
 */

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [tsconfigPaths()],

  resolve: {
    alias: {
      // Substituir módulos Next.js por mocks estáticos em ambiente de teste.
      // next/headers usa workAsyncStorage do runtime Next.js — impossível em Vitest puro.
      "next/headers": path.resolve(__dirname, "src/__tests__/helpers/next-mocks/headers.ts"),
      "next/server":  path.resolve(__dirname, "src/__tests__/helpers/next-mocks/server.ts"),
    },
  },

  test: {
    // Globals: describe, it, expect, vi sem import explícito
    globals: true,

    // Ambiente Node (sem DOM — APIs Next.js são mockadas nos ficheiros de teste)
    environment: "node",

    // Setup executado antes de cada ficheiro de teste
    setupFiles: ["./src/__tests__/setup.ts"],

    // Incluir apenas ficheiros dentro de src/__tests__
    include: ["src/__tests__/**/*.test.ts"],

    // Excluir node_modules e .next
    exclude: ["node_modules", ".next", "src/__tests__/helpers/**"],

    // Relatório de cobertura
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",

      // Apenas ficheiros de lib críticos
      include: [
        "src/lib/validators.ts",
        "src/lib/rateLimit.ts",
        "src/lib/finance.ts",
        "src/lib/pricing-service.ts",
        "src/lib/event-bus.ts",
        "src/lib/document-numbering.ts",
        "src/lib/auth.ts",
        // CRM — adicionado em RFT-106
        "src/lib/pipeline-state-machine.ts",
        "src/lib/crm-validators.ts",
      ],

      // Excluir ficheiros que precisam de runtime Next.js ou Prisma real
      exclude: [
        "src/lib/prisma.ts",
        "src/lib/email.ts",
        "src/lib/bootstrap.ts",
        "src/lib/event-handlers.ts",
        "src/lib/notifications.ts",
        "src/lib/timeline.ts",
        "src/lib/finance-service.ts",
        "src/lib/currency.ts",
        "src/lib/countryCode.ts",
      ],

      // Thresholds mínimos — Quality Gate P0-C
      thresholds: {
        lines:      60,
        functions:  60,
        branches:   60,
        statements: 60,
      },
    },

    // Timeout por teste (ms)
    testTimeout: 5000,

    // Reporter
    reporter: ["verbose"],
  },
});
