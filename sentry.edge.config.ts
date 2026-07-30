/**
 * sentry.edge.config.ts — Configuração do Sentry no Edge Runtime
 *
 * Captura erros no middleware Next.js (src/middleware.ts).
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV === "production",
});
