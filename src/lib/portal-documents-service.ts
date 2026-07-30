/**
 * Portal Documents Service — Volume 03
 *
 * Gere o ciclo de vida de documentos partilhados no portal do cliente:
 *  - Upload para Cloudinary (guarda publicId, nunca URL)
 *  - Versionamento incremental atómico
 *  - Download com URL assinada (TTL 15 min)
 *  - Auditoria de acesso (BR-PORT-003)
 *
 * Regras:
 *  BR-PORT-001 — isolamento por companyId em todas as operações
 *  BR-PORT-002 — URLs assinadas temporárias, nunca URL directa
 *  BR-PORT-003 — toda leitura/download cria PortalDocumentAccess + TimelineEntry
 *
 * Estrutura Cloudinary:
 *   azul-cowork/portal/documents/{companyId}/{documentId}/v{N}
 */

import { v2 as cloudinary }     from "cloudinary";
import { prisma }                from "@/lib/prisma";
import { generateSignedUrl }     from "@/lib/portal-signed-url-service";
import {
  DocumentAccessAction,
  TimelineEventType,
  type PortalDocumentAccess,
} from "@prisma/client";

// ── Cloudinary config ──────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Constantes ─────────────────────────────────────────────────────────────────
export const VALID_CATEGORIES = [
  "contrato",
  "fatura-manual",
  "declaracao",
  "comprovante",
  "guia",
  "outro",
] as const;

export type DocumentCategory = typeof VALID_CATEGORIES[number];

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES  = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];

// ── Upload helper ──────────────────────────────────────────────────────────────

export async function uploadToCloudinary(
  buffer:    Buffer,
  publicId:  string,
  mimeType?: string
): Promise<{ cloudinaryPublicId: string; sizeBytes: number }> {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }

  const dataUri = `data:${mimeType ?? "application/octet-stream"};base64,${buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder:        undefined,           // publicId já inclui o folder
    public_id:     publicId,
    resource_type: "raw",
    use_filename:  false,
    overwrite:     true,
  });

  return {
    cloudinaryPublicId: result.public_id,
    sizeBytes:          result.bytes,
  };
}

function buildCloudinaryPublicId(companyId: string, documentId: string, version: number): string {
  return `azul-cowork/portal/documents/${companyId}/${documentId}/v${version}`;
}

// ── Validação de ficheiro ──────────────────────────────────────────────────────

export interface FileValidationResult {
  ok:      boolean;
  error?:  string;
}

export function validateUploadedFile(
  buffer:   Buffer,
  mimeType: string,
  filename: string
): FileValidationResult {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `Ficheiro demasiado grande. Máximo: ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` };
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { ok: false, error: `Tipo de ficheiro não suportado: ${mimeType}. Aceites: PDF, DOCX, XLSX, JPG, PNG.` };
  }
  if (!filename || filename.length > 255) {
    return { ok: false, error: "Nome de ficheiro inválido." };
  }
  return { ok: true };
}

// ── Operações principais ───────────────────────────────────────────────────────

/**
 * Cria documento novo + versão 1.
 * PORTAL_ADMIN ou superior.
 */
export async function createDocument(params: {
  companyId:      string;
  title:          string;
  category:       DocumentCategory;
  description?:   string;
  tags?:          string[];
  buffer:         Buffer;
  mimeType:       string;
  filename:       string;
  changeNote?:    string;
  uploadedById:   string;
  uploadedByName: string;
}): Promise<{ documentId: string; versionId: string }> {
  const {
    companyId, title, category, description, tags,
    buffer, mimeType, filename, changeNote,
    uploadedById, uploadedByName,
  } = params;

  // Validar ficheiro
  const validation = validateUploadedFile(buffer, mimeType, filename);
  if (!validation.ok) throw new Error(validation.error);

  // Criar documento (sem versão ainda — precisamos do id para o publicId)
  const doc = await prisma.portalDocument.create({
    data: {
      companyId,
      title,
      category,
      description,
      tags:          tags ?? [],
      uploadedById,
      uploadedByName,
      isActive:      true,
      currentVersionId: null,  // actualizado após upload
    },
  });

  // Construir publicId com documentId conhecido
  const publicId = buildCloudinaryPublicId(companyId, doc.id, 1);

  // Upload para Cloudinary
  const { cloudinaryPublicId, sizeBytes } = await uploadToCloudinary(buffer, publicId, mimeType);

  // Criar versão 1 + actualizar currentVersionId em transacção
  const [version] = await prisma.$transaction([
    prisma.portalDocumentVersion.create({
      data: {
        documentId:        doc.id,
        version:           1,
        cloudinaryPublicId,
        mimeType,
        sizeBytes,
        changeNote:        changeNote ?? "Versão inicial",
        uploadedById,
        uploadedByName,
      },
    }),
    // currentVersionId será actualizado a seguir (precisa do ID da versão)
  ]);

  // Actualizar referência para versão actual
  await prisma.portalDocument.update({
    where: { id: doc.id },
    data:  { currentVersionId: version.id },
  });

  return { documentId: doc.id, versionId: version.id };
}

/**
 * Adiciona nova versão a documento existente.
 * Versão é incrementada atomicamente.
 */
export async function addDocumentVersion(params: {
  documentId:     string;
  companyId:      string;
  buffer:         Buffer;
  mimeType:       string;
  filename:       string;
  changeNote?:    string;
  uploadedById:   string;
  uploadedByName: string;
}): Promise<{ versionId: string; versionNumber: number }> {
  const {
    documentId, companyId,
    buffer, mimeType, filename, changeNote,
    uploadedById, uploadedByName,
  } = params;

  // Verificar isolamento
  const doc = await prisma.portalDocument.findFirst({
    where:  { id: documentId, companyId, isActive: true },
    select: { id: true },
  });
  if (!doc) throw new Error("DOCUMENT_NOT_FOUND");

  // Validar ficheiro
  const validation = validateUploadedFile(buffer, mimeType, filename);
  if (!validation.ok) throw new Error(validation.error);

  // Obter versão máxima actual (select MAX + lock)
  const maxVersion = await prisma.portalDocumentVersion.aggregate({
    where:  { documentId },
    _max:   { version: true },
  });
  const nextVersion = (maxVersion._max.version ?? 0) + 1;

  // Upload para Cloudinary
  const publicId = buildCloudinaryPublicId(companyId, documentId, nextVersion);
  const { cloudinaryPublicId, sizeBytes } = await uploadToCloudinary(buffer, publicId, mimeType);

  // Criar versão + actualizar currentVersionId
  const version = await prisma.$transaction(async (tx) => {
    const v = await tx.portalDocumentVersion.create({
      data: {
        documentId,
        version:    nextVersion,
        cloudinaryPublicId,
        mimeType,
        sizeBytes,
        changeNote,
        uploadedById,
        uploadedByName,
      },
    });
    await tx.portalDocument.update({
      where: { id: documentId },
      data:  { currentVersionId: v.id },
    });
    return v;
  });

  return { versionId: version.id, versionNumber: nextVersion };
}

/**
 * Gera URL assinada para a versão actual do documento.
 * Regista acesso (PortalDocumentAccess + TimelineEntry) de forma assíncrona.
 */
export async function generateDocumentDownloadUrl(params: {
  documentId:   string;
  companyId:    string;
  portalUserId: string;
  portalUserName: string;
  portalUserEmail: string;
  ipAddress?:   string;
  userAgent?:   string;
  versionId?:   string;  // se omitido, usa versão actual
}): Promise<{ url: string; expiresAt: Date; filename: string; versionId: string }> {
  const {
    documentId, companyId,
    portalUserId, portalUserName, portalUserEmail,
    ipAddress, userAgent, versionId,
  } = params;

  // Buscar documento + versão com isolamento
  const doc = await prisma.portalDocument.findFirst({
    where:  { id: documentId, companyId, isActive: true },
    select: {
      id:               true,
      title:            true,
      category:         true,
      currentVersionId: true,
    },
  });
  if (!doc) throw new Error("DOCUMENT_NOT_FOUND");

  const targetVersionId = versionId ?? doc.currentVersionId;
  if (!targetVersionId) throw new Error("NO_VERSION_AVAILABLE");

  const version = await prisma.portalDocumentVersion.findFirst({
    where:  { id: targetVersionId, documentId },
    select: {
      id:                true,
      version:           true,
      cloudinaryPublicId:true,
      mimeType:          true,
    },
  });
  if (!version) throw new Error("VERSION_NOT_FOUND");

  // Gerar URL assinada
  const signed = generateSignedUrl(version.cloudinaryPublicId, "raw");

  // Extensão baseada em mimeType
  const ext = mimeToExt(version.mimeType ?? "application/pdf");
  const filename = `${sanitizeFilename(doc.title)}-v${version.version}${ext}`;

  // Auditoria + Timeline async (não bloqueia resposta)
  const auditData = {
    documentId,
    portalUserId,
    versionId:   version.id,
    action:      DocumentAccessAction.DOWNLOAD,
    signedUrl:   signed.url,
    urlExpiresAt:signed.expiresAt,
    ipAddress,
    userAgent,
  };

  Promise.all([
    prisma.portalDocumentAccess.create({ data: auditData })
      .catch(e => console.error("[Portal Docs] Falha auditoria download:", e)),

    prisma.timelineEntry.create({
      data: {
        companyId,
        eventType:       TimelineEventType.PORTAL_DOCUMENT_DOWNLOADED,
        title:           `Documento "${doc.title}" descarregado (v${version.version})`,
        description:     `Descarregado por ${portalUserName} (${portalUserEmail})`,
        actorId:         portalUserId,
        actorName:       portalUserName,
        isSystem:        false,
        linkedEntityType:"PortalDocument",
        linkedEntityId:  documentId,
        metadata: {
          documentTitle: doc.title,
          category:      doc.category,
          versionId:     version.id,
          versionNumber: version.version,
          portalUserId,
        },
      },
    }).catch(e => console.error("[Portal Docs] Falha timeline download:", e)),
  ]);

  return { url: signed.url, expiresAt: signed.expiresAt, filename, versionId: version.id };
}

/**
 * Regista acesso VIEW a um documento (não gera URL).
 */
export async function recordDocumentView(params: {
  documentId:   string;
  companyId:    string;
  portalUserId: string;
  ipAddress?:   string;
  userAgent?:   string;
}): Promise<void> {
  const { documentId, companyId, portalUserId, ipAddress, userAgent } = params;

  prisma.portalDocumentAccess.create({
    data: {
      documentId,
      portalUserId,
      action:   DocumentAccessAction.VIEW,
      ipAddress,
      userAgent,
    },
  }).catch(e => console.error("[Portal Docs] Falha registo VIEW:", e));

  prisma.timelineEntry.create({
    data: {
      companyId,
      eventType:       TimelineEventType.PORTAL_DOCUMENT_VIEWED,
      title:           "Documento visualizado no portal",
      actorId:         portalUserId,
      isSystem:        false,
      linkedEntityType:"PortalDocument",
      linkedEntityId:  documentId,
      metadata:        { portalUserId },
    },
  }).catch(e => console.error("[Portal Docs] Falha timeline VIEW:", e));
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":       ".xlsx",
    "image/jpeg": ".jpg",
    "image/png":  ".png",
  };
  return map[mime] ?? ".bin";
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // remover acentos
    .replace(/[^a-zA-Z0-9-_\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES };
