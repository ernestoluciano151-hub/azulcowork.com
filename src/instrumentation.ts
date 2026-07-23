/**
 * Next.js Instrumentation Hook
 * Executado uma vez no arranque do servidor — regista o Event Bus.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrap } = await import("./lib/bootstrap");
    bootstrap();
  }
}
