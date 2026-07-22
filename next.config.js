/** @type {import('next').NextConfig} */

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
      // Scripts: próprio domínio + Vturb/Converteai
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://scripts.converteai.net https://cdn.converteai.net",
      // Estilos: próprio domínio + inline (Tailwind)
      "style-src 'self' 'unsafe-inline'",
      // Imagens: próprio domínio + Cloudinary + dados inline
      "img-src 'self' data: blob: https://res.cloudinary.com",
      // Media (vídeos VSL)
      "media-src 'self' https://cdn.converteai.net https://scripts.converteai.net blob:",
      // Frames (player Vturb)
      "frame-src 'self' https://scripts.converteai.net https://cdn.converteai.net",
      // Fontes
      "font-src 'self' data:",
      // Conexões (API própria + Neon DB via Prisma no servidor + Cloudinary)
      "connect-src 'self' https://res.cloudinary.com",
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

module.exports = nextConfig;
