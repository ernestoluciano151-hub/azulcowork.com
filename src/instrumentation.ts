/**
 * Next.js Instrumentation Hook
 * Executado uma vez no arranque do servidor — regista o Event Bus e inicializa o Sentry.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * 04 Ago 2026 (correcção crítica — piloto): `sentry.server.config.ts` e
 * `sentry.edge.config.ts` existiam mas NUNCA eram importados por ninguém —
 * o `withSentryConfig` em next.config.js só cuida do build (upload de
 * sourcemaps, etc.), não chama Sentry.init() no App Router. Resultado: o
 * SDK nunca arrancava em produção, `Sentry.captureException(...)` em toda a
 * app era um no-op silencioso, e o dashboard mostrava sempre "Waiting for
 * this project's first error" mesmo com falhas reais e repetidas (ex.: PDF
 * de recibo). Corrigido importando explicitamente os configs aqui, como a
 * documentação do @sentry/nextjs exige para o App Router.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrap } = await import("./lib/bootstrap");
    bootstrap();
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
