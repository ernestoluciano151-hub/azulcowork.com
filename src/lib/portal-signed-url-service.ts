/**
 * Portal Signed URL Service — Volume 03
 *
 * Gera URLs assinadas do Cloudinary com TTL 15 minutos.
 * Regra BR-PORT-002: NUNCA expor URL directa do Cloudinary ao cliente.
 *
 * ADR-028: Signed downloads via Cloudinary signed URLs.
 *
 * Uso: faturas PDF, recibos PDF, documentos do portal.
 */

import { v2 as cloudinary } from "cloudinary";

const SIGNED_URL_TTL_SECONDS = 15 * 60; // 15 minutos

// Configuração Cloudinary (partilhada com erp-communication-service)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface SignedUrlResult {
  url:       string;
  expiresAt: Date;
}

/**
 * Gera URL assinada para um ficheiro no Cloudinary.
 * TTL: 15 minutos. O ficheiro torna-se inacessível após expiração.
 *
 * @param publicId   — ID público do Cloudinary (ex.: "azul-cowork/invoices/2026/FT-CWORK-2026-000001")
 * @param resourceType — "raw" para PDFs/documentos, "image" para imagens
 *
 * @throws "CLOUDINARY_NOT_CONFIGURED" se variáveis de ambiente em falta
 */
export function generateSignedUrl(
  publicId:     string,
  resourceType: "raw" | "image" = "raw"
): SignedUrlResult {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }

  const expiresAtTimestamp = Math.round(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const expiresAt          = new Date(expiresAtTimestamp * 1000);

  // Gerar URL assinada com expiração
  // private_download_url: requer autenticação Cloudinary + assinatura HMAC-SHA1
  const url = cloudinary.utils.private_download_url(
    publicId,
    resourceType === "raw" ? "pdf" : "jpg",
    {
      resource_type: resourceType,
      expires_at:    expiresAtTimestamp,
      attachment:    true,  // força download (Content-Disposition: attachment)
    }
  );

  return { url, expiresAt };
}

/**
 * Extrai o publicId de uma URL Cloudinary.
 * Útil quando o sistema guardou a URL completa em vez do publicId.
 *
 * Ex.: "https://res.cloudinary.com/demo/raw/upload/v1/azul-cowork/invoices/file.pdf"
 *      → "azul-cowork/invoices/file"
 */
export function extractPublicIdFromUrl(cloudinaryUrl: string): string | null {
  try {
    const url  = new URL(cloudinaryUrl);
    const path = url.pathname;
    // Remove: /cloud_name/resource_type/delivery_type/version/
    // Ex.: /demo/raw/upload/v123456789/azul-cowork/invoices/file.pdf
    const match = path.match(/\/(?:raw|image|video)\/(?:upload|authenticated)(?:\/v\d+)?\/(.+)$/);
    if (!match) return null;
    // Remover extensão do ficheiro
    const withExt = match[1];
    return withExt.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}

/**
 * Verifica se uma URL Cloudinary é directa (não assinada).
 * Retorna true se a URL não contiver parâmetros de assinatura.
 * Usado em testes para garantir que nunca se expõe URLs directas.
 */
export function isDirectCloudinaryUrl(url: string): boolean {
  return url.includes("res.cloudinary.com") && !url.includes("signature=") && !url.includes("s--");
}

export { SIGNED_URL_TTL_SECONDS };
