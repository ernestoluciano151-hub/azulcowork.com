/**
 * sentry.client.config.ts — Configuração do Sentry no cliente (browser)
 *
 * Activado automaticamente pelo `withSentryConfig` em next.config.js.
 * Este ficheiro NÃO deve ser importado manualmente.
 *
 * Instalar: npm install @sentry/nextjs
 * Variável obrigatória: NEXT_PUBLIC_SENTRY_DSN em .env.local e no Vercel.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capturar 10% das transacções de performance em produção
  // Aumentar para 1.0 em desenvolvimento para debugging
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Não enviar eventos em desenvolvimento local (evita ruído no dashboard)
  enabled: process.env.NODE_ENV === "production",

  // Ignorar erros esperados (ex: ResizeObserver, Next.js router)
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    "ChunkLoadError",
    // Next.js navigation abort
    "AbortError: The user aborted a request.",
  ],
});
