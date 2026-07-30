/**
 * sentry.server.config.ts — Configuração do Sentry no servidor (Node.js)
 *
 * Captura erros em API Routes, Server Components e Server Actions.
 * Activado automaticamente pelo `withSentryConfig` em next.config.js.
 *
 * Instalar: npm install @sentry/nextjs
 * Variável obrigatória: SENTRY_DSN em .env.local e no Vercel.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Capturar 10% das transacções de performance em produção
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Não enviar eventos em desenvolvimento local
  enabled: process.env.NODE_ENV === "production",

  // Adicionar contexto de ambiente a todos os eventos
  environment: process.env.NODE_ENV ?? "development",

  // Breadcrumbs para operações financeiras críticas
  // (configurar em cada operação com Sentry.addBreadcrumb)
  maxBreadcrumbs: 50,

  // Não capturar erros esperados de rate limiting (429)
  beforeSend(event) {
    // Suprimir erros de rate limiting (são comportamento esperado, não bugs)
    if (event.exception?.values?.[0]?.value?.includes("429")) {
      return null;
    }
    return event;
  },
});
