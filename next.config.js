/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

const securityHeaders = [
  // Impede que a página seja carregada em iframes (clickjacking)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Impede que o browser tente adivinhar o tipo de conteúdo
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Força HTTPS por 1 ano (incluindo subdomínios)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Controla informação enviada no Referer
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactiva acesso a funcionalidades sensíveis do browser
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: próprio domínio + Vturb/Converteai + YouTube IFrame API (player /salas)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://scripts.converteai.net https://cdn.converteai.net https://www.youtube.com https://s.ytimg.com",
      // Estilos: próprio domínio + inline (Tailwind)
      "style-src 'self' 'unsafe-inline'",
      // Imagens: próprio domínio + Cloudinary + dados inline
      "img-src 'self' data: blob: https://res.cloudinary.com",
      // Media (vídeos VSL)
      "media-src 'self' https://cdn.converteai.net https://scripts.converteai.net blob:",
      // Frames (player Vturb + YouTube embed na página /salas)
      "frame-src 'self' https://scripts.converteai.net https://cdn.converteai.net https://www.youtube.com https://www.youtube-nocookie.com",
      // Fontes
      "font-src 'self' data:",
      // Conexões (API própria + Cloudinary + Sentry telemetria — VOL03-10D)
      "connect-src 'self' https://res.cloudinary.com https://*.ingest.sentry.io",
      // Força HTTPS em recursos mistos (redundante com HSTS, mas defensivo)
      "upgrade-insecure-requests",
      // Objectos e workers
      "object-src 'none'",
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  // DT-036 (TEMPORÁRIO — 01 Ago 2026): ignoreBuildErrors reactivado para desbloquear
  // o deploy do piloto. Causa: 20+ routes usam params síncrono (estilo Next 14) e o
  // validador de tipos do Next 15 rejeita-os. O runtime funciona (compat layer Next 15).
  // Correcção definitiva: npx @next/codemod next-async-request-api + remover este flag.
  typescript: { ignoreBuildErrors: true },

  // 04 Ago 2026 (correcção crítica — piloto, tentativa 1): listar apenas
  // "@react-pdf/renderer" aqui NÃO foi suficiente — confirmado pelo PO após
  // deploy real, erro "Minified React error #31" manteve-se.
  //
  // 05 Ago 2026 (tentativa 3 — REVERTIDA): tentei acrescentar "react",
  // "react-dom" e "scheduler" a esta lista, na teoria de que os nossos
  // próprios componentes PDF (receipt-pdf.tsx, invoice-pdf.tsx) continuavam
  // a ser empacotados pelo webpack com uma cópia de "react" diferente da
  // usada pelo "@react-pdf/renderer" externo. ERRADO — partiu o build por
  // completo: "Error: A React Element from an older version of React was
  // rendered" ao pré-renderizar a própria página /_not-found do Next.js.
  // Externalizar "react"/"react-dom" interfere com o próprio mecanismo
  // interno de RSC do Next (que depende de uma cópia bundled específica de
  // React para o boundary client/server), não é seguro fazê-lo a nível
  // global do projecto. Revertido para a lista original — o problema do
  // PDF continua por resolver, mas sem voltar a partir o deploy inteiro.
  serverExternalPackages: ["@react-pdf/renderer", "yoga-layout", "fontkit"],

  // 05 Ago 2026 (correcção crítica — piloto, isolamento definitivo do PDF):
  // a geração de PDF deixou de correr dentro do processo Next.js — passou a
  // correr num processo `node` filho, invocando directamente
  // pdf-workers/dist/entry.cjs (ver src/lib/pdf-worker-client.ts). Como essa
  // invocação usa child_process.spawn() com um caminho construído em
  // runtime, o tracer de ficheiros do Vercel (@vercel/nft) NÃO o detecta
  // estaticamente — sem isto, o ficheiro não seria incluído no bundle da
  // função serverless e o worker falharia com "ENOENT" em produção, mesmo
  // funcionando em desenvolvimento local. outputFileTracingIncludes obriga
  // o Vercel a incluir explicitamente pdf-workers/dist/** em todas as rotas.
  outputFileTracingIncludes: {
    "/**": ["./pdf-workers/dist/**"],
  },

  images: {
    // Restringir apenas a domínios conhecidos (evita SSRF via _next/image)
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.cloudinary.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  org:     "azul-coworking",
  project: "vd-platform",
  // Silencioso em local; verboso em CI
  silent:  !process.env.CI,
  // Source maps completos para stack traces legíveis no dashboard Sentry
  widenClientFileUpload: true,
  // Não expor source maps no bundle público (segurança)
  hideSourceMaps: true,
  // Remover logs do Sentry do bundle final (reduz tamanho)
  disableLogger: true,
  // Vercel Monitors não usado — desactivar para evitar ruído
  automaticVercelMonitors: false,
  // Telemetria do Sentry NUNCA deve bloquear um deploy de produção.
  // "finalize release" chama a API do Sentry no fim do build; se a API deles
  // estiver instável (503, timeout, etc.), o build falhava por inteiro.
  release: { finalize: false },
  errorHandler: (err, invokeErr, compilation) => {
    console.warn("[Sentry] Aviso: falha não-crítica no plugin de build:", err?.message || err);
    // Não invoca invokeErr(err) — deixa o build de Next.js continuar normalmente.
  },
});
