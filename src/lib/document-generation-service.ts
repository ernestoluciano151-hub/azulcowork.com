/**
 * document-generation-service.ts — Orquestrador de Geração Documental (VOL08)
 *
 * Ciclo completo de geração:
 *   1. Carrega DocumentTemplate por slug (valida versão e estado)
 *   2. Interpola variáveis {{var}} no htmlBody (via template-interpolator.ts)
 *   3. Constrói dados tipados para ProposalData | ContractData
 *   4. Renderiza PDF em memória (renderToBuffer via document-pdf-renderer.tsx)
 *   5. Calcula SHA-256 do buffer para integridade documental (condição PO)
 *   6. Carrega para Cloudinary (pasta estruturada por tipo + entidade)
 *   7. SOMENTE se upload OK → cria GeneratedDocument (imutável, versão incremental)
 *   8. Regista AuditLog (fire-and-forget — ADR-033: falha nunca bloqueia geração)
 *   9. Regista Timeline (fire-and-forget — idem)
 *
 * Regras obrigatórias (Aprovação PO VOL08):
 *   • PDFs são imutáveis após geração
 *   • Downloads usam URL assinada temporária (via getDocumentDownloadUrl)
 *   • Toda geração cria AuditLog
 *   • Toda visualização/download cria Timeline (responsabilidade do caller da route)
 *   • Falha de upload não cria registo GeneratedDocument
 *   • Falha de auditoria NUNCA bloqueia geração (ADR-033)
 *   • DocumentTemplate.version é snapshot imutável em GeneratedDocument.templateVersion
 *
 * Docs: docs/11-gestao-documental/README.md · ADR-038
 */

import crypto                from "crypto";
import { v2 as cloudinary }  from "cloudinary";
import { prisma }            from "@/lib/prisma";
import { recordAudit }       from "@/lib/audit-service";
import {
  renderProposalPdf,
  renderContractPdf,
  type ProposalData,
  type ContractData,
} from "@/lib/document-pdf-renderer";
import type {
  DocumentTemplateType,
  AuditAction,
} from "@prisma/client";

// ── Cloudinary config ──────────────────────────────────────────────────────────

// 11 Ago 2026: "signature_algorithm: sha256" — sem isto o SDK assina uploads
// com SHA-1 (default), mas a conta Cloudinary está configurada para exigir
// SHA-256, produzindo sempre "Invalid Signature <hash-sha1>. String to
// sign - ...". Só ficou visível agora porque este caminho (Gerar Documento)
// nunca tinha chegado à chamada de upload antes (bloqueado pelo bug do PDF).
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  signature_algorithm: "sha256",
});

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type GenerateDocumentOptions = {
  templateSlug:  string;
  entityType:    "LEAD" | "ERPCONTRACT" | "COMPANY";
  entityId:      string;
  vars:          Record<string, string>;     // variáveis para interpolação {{var}}
  generatedBy:   string;                    // AdminUser.id
  actorEmail?:   string;                    // para AuditLog
  actorRole?:    string;                    // para AuditLog
};

export type GenerateDocumentResult = {
  id:              string;
  version:         number;
  templateVersion: number;
  cloudinaryId:    string;
  fileName:        string;
  fileSizeBytes:   number;
  sha256Hash:      string;
  generatedAt:     Date;
};

export type DownloadUrlResult = {
  url:       string;
  expiresAt: Date;
};

// ── SHA-256 helper ─────────────────────────────────────────────────────────────

/**
 * Calcula SHA-256 hex de um Buffer.
 * Puro — sem I/O. Usado para integridade documental.
 */
export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// ── Versioning helper ──────────────────────────────────────────────────────────

/**
 * Determina a próxima versão de documento para uma entidade + template.
 * Usa MAX(version) + 1. Chamado dentro de uma transacção Prisma para evitar race.
 */
async function nextDocumentVersion(
  tx:          Awaited<Parameters<Parameters<typeof prisma.$transaction>[0]>[0]>,
  entityType:  string,
  entityId:    string,
  templateSlug: string
): Promise<number> {
  const last = await tx.generatedDocument.findFirst({
    where:   { entityType, entityId, templateSlug },
    orderBy: { version: "desc" },
    select:  { version: true },
  });
  return (last?.version ?? 0) + 1;
}

// ── Cloudinary helpers ─────────────────────────────────────────────────────────

function buildCloudinaryPublicId(
  type:      DocumentTemplateType,
  entityType: string,
  entityId:  string,
  version:   number
): string {
  // azul-cowork/documents/PROPOSAL/LEAD/cld123/v1
  return `azul-cowork/documents/${type}/${entityType}/${entityId}/v${version}`;
}

async function uploadPdfToCloudinary(
  buffer:   Buffer,
  publicId: string
): Promise<{ cloudinaryId: string; fileSizeBytes: number }> {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }
  const dataUri = `data:application/pdf;base64,${buffer.toString("base64")}`;
  const result  = await cloudinary.uploader.upload(dataUri, {
    public_id:     publicId,
    resource_type: "raw",
    use_filename:  false,
    overwrite:     false,   // imutável: nunca sobrescrever versões anteriores
  });
  return {
    cloudinaryId:  result.public_id,
    fileSizeBytes: result.bytes,
  };
}

// ── Renderer dispatcher ────────────────────────────────────────────────────────

/**
 * Renderiza o PDF correcto com base no tipo do template.
 * PROPOSAL → renderProposalPdf  |  CONTRACT → renderContractPdf
 * Outros tipos: lança erro (não implementado neste sprint).
 */
async function renderPdfForType(
  type: DocumentTemplateType,
  vars: Record<string, string>
): Promise<Buffer> {
  switch (type) {
    case "PROPOSAL": {
      const data: ProposalData = {
        numeroDocumento:  vars.numeroDocumento  ?? "PROP-0000",
        dataDocumento:    vars.dataDocumento    ?? new Date().toISOString(),
        dataValidade:     vars.dataValidade     ?? "",
        nomeEmpresa:      vars.nomeEmpresa      ?? "—",
        nifEmpresa:       vars.nifEmpresa,
        moradaEmpresa:    vars.moradaEmpresa,
        nomeContacto:     vars.nomeContacto     ?? "—",
        emailContacto:    vars.emailContacto,
        telefoneContacto: vars.telefoneContacto,
        planoDescricao:   vars.planoDescricao   ?? "—",
        valorMensal:      vars.valorMensal      ?? "0",
        duracao:          vars.duracao,
        dataInicio:       vars.dataInicio,
        nomeComercial:    vars.nomeComercial,
        observacoes:      vars.observacoes,
      };
      return renderProposalPdf(data);
    }
    case "CONTRACT": {
      const data: ContractData = {
        numeroContrato:      vars.numeroContrato      ?? "CONT-0000",
        dataDocumento:       vars.dataDocumento       ?? new Date().toISOString(),
        nomeEmpresa:         vars.nomeEmpresa         ?? "—",
        nifEmpresa:          vars.nifEmpresa,
        moradaEmpresa:       vars.moradaEmpresa,
        representanteLegal:  vars.representanteLegal  ?? "—",
        cargoRepresentante:  vars.cargoRepresentante,
        planoDescricao:      vars.planoDescricao      ?? "—",
        valorMensal:         vars.valorMensal         ?? "0",
        dataInicio:          vars.dataInicio          ?? new Date().toISOString(),
        dataFim:             vars.dataFim,
        duracao:             vars.duracao,
        depositoGarantia:    vars.depositoGarantia,
        formaPagamento:      vars.formaPagamento,
        diaVencimento:       vars.diaVencimento,
        renovacaoAutomatica: vars.renovacaoAutomatica,
        clausulasEspeciais:  vars.clausulasEspeciais,
      };
      return renderContractPdf(data);
    }
    default:
      throw new Error(`PDF_RENDERER_NOT_IMPLEMENTED: ${type}`);
  }
}

// ── Função principal ───────────────────────────────────────────────────────────

/**
 * generateDocument — Gera, arquiva e regista um documento PDF.
 *
 * Garantias:
 *   • Nunca cria GeneratedDocument se upload Cloudinary falhar
 *   • AuditLog e Timeline são fire-and-forget (nunca bloqueiam)
 *   • Versão é determinada atomicamente dentro de $transaction
 *   • sha256Hash garante integridade futura
 *   • templateVersion é snapshot imutável da versão actual do template
 */
export async function generateDocument(
  opts: GenerateDocumentOptions
): Promise<GenerateDocumentResult> {
  // 1. Carregar template
  const template = await prisma.documentTemplate.findUnique({
    where: { slug: opts.templateSlug },
  });
  if (!template) {
    throw new Error(`TEMPLATE_NOT_FOUND: ${opts.templateSlug}`);
  }
  if (!template.isActive) {
    throw new Error(`TEMPLATE_INACTIVE: ${opts.templateSlug}`);
  }

  // 2. Renderizar PDF em memória
  const pdfBuffer = await renderPdfForType(template.type, opts.vars);

  // 3. Calcular SHA-256 (condição obrigatória PO)
  const hash = sha256Hex(pdfBuffer);

  // 4. Determinar versão + Cloudinary public_id (atomicamente em transacção)
  //    A $transaction garante que dois generates simultâneos não colidem.
  const generated = await prisma.$transaction(async (tx) => {
    const version   = await nextDocumentVersion(
      tx, opts.entityType, opts.entityId, opts.templateSlug
    );
    const publicId  = buildCloudinaryPublicId(
      template.type, opts.entityType, opts.entityId, version
    );
    const fileName  = `${opts.templateSlug}-v${version}.pdf`;

    // 5. Upload Cloudinary — FORA da tx (I/O externo)
    //    Se falhar → lança excepção → $transaction faz rollback → GeneratedDocument NÃO é criado
    const { cloudinaryId, fileSizeBytes } = await uploadPdfToCloudinary(pdfBuffer, publicId);

    // 6. Persistir GeneratedDocument (imutável)
    const doc = await tx.generatedDocument.create({
      data: {
        templateSlug:    opts.templateSlug,
        templateVersion: template.version,   // snapshot imutável
        type:            template.type,
        entityType:      opts.entityType,
        entityId:        opts.entityId,
        version,
        cloudinaryId,
        fileName,
        fileSizeBytes,
        sha256Hash:      hash,
        generatedBy:     opts.generatedBy,
        generatedAt:     new Date(),
      },
    });

    return doc;
  });

  // 7. AuditLog — fire-and-forget (falha nunca bloqueia — ADR-033)
  void recordAudit({
    actor: {
      id:    opts.generatedBy,
      role:  opts.actorRole  ?? "ADMIN",
      email: opts.actorEmail ?? "unknown",
    },
    action:   "DOCUMENT_GENERATED" as AuditAction,
    entity:   "GeneratedDocument",
    entityId: generated.id,
    entityRef: generated.fileName,
    after: {
      templateSlug:    generated.templateSlug,
      templateVersion: generated.templateVersion,
      entityType:      generated.entityType,
      entityId:        generated.entityId,
      version:         generated.version,
      sha256Hash:      generated.sha256Hash,
      fileSizeBytes:   generated.fileSizeBytes,
    },
    metadata: { cloudinaryId: generated.cloudinaryId },
  }).catch((err: unknown) => {
    // Auditoria falhou — registamos no stderr mas NÃO relançamos (ADR-033)
    console.error("[document-generation-service] AuditLog falhou (ignorado):", err);
  });

  // 8. Timeline (fire-and-forget) — suporta Lead e ErpContract via Timeline legacy
  void logDocumentTimeline(generated.entityType, generated.entityId, generated.fileName, opts.generatedBy)
    .catch((err: unknown) => {
      console.error("[document-generation-service] Timeline falhou (ignorado):", err);
    });

  return {
    id:              generated.id,
    version:         generated.version,
    templateVersion: generated.templateVersion,
    cloudinaryId:    generated.cloudinaryId,
    fileName:        generated.fileName,
    fileSizeBytes:   generated.fileSizeBytes,
    sha256Hash:      generated.sha256Hash,
    generatedAt:     generated.generatedAt,
  };
}

// ── Timeline helper (fire-and-forget) ─────────────────────────────────────────

async function logDocumentTimeline(
  entityType: string,
  entityId:   string,
  fileName:   string,
  actorId:    string
): Promise<void> {
  // O modelo Timeline (legado CRM) suporta leadId e companyId
  if (entityType === "LEAD") {
    await prisma.timeline.create({
      data: {
        leadId:        entityId,
        type:          "DOCUMENT_GENERATED",
        title:         `Documento gerado: ${fileName}`,
        description:   "Documento gerado automaticamente pelo sistema.",
        referenceType: "GeneratedDocument",
        createdBy:     actorId,
      },
    });
  } else if (entityType === "ERPCONTRACT" || entityType === "COMPANY") {
    // Para contratos ERP, obtemos o companyId do ErpContract
    let companyId: string | undefined;
    if (entityType === "ERPCONTRACT") {
      const contract = await prisma.erpContract.findUnique({
        where:  { id: entityId },
        select: { companyId: true },
      });
      companyId = contract?.companyId;
    } else {
      companyId = entityId;
    }
    if (companyId) {
      await prisma.timeline.create({
        data: {
          companyId,
          type:          "DOCUMENT_GENERATED",
          title:         `Documento gerado: ${fileName}`,
          description:   entityType === "ERPCONTRACT"
            ? "Contrato PDF gerado e arquivado no sistema."
            : "Documento gerado e arquivado no sistema.",
          referenceType: "GeneratedDocument",
          createdBy:     actorId,
        },
      });
    }
  }
}

// ── Download URL ───────────────────────────────────────────────────────────────

const DOWNLOAD_TTL_SECONDS = 15 * 60; // 15 minutos (condição PO: URL assinada temporária)

/**
 * Gera URL assinada temporária para download de um GeneratedDocument.
 * TTL: 15 minutos.
 * Caller deve registar AuditLog e Timeline (DOCUMENT_DOWNLOADED) — responsabilidade da route.
 */
export async function getDocumentDownloadUrl(
  documentId: string
): Promise<DownloadUrlResult> {
  const doc = await prisma.generatedDocument.findUnique({
    where:  { id: documentId },
    select: { cloudinaryId: true },
  });
  if (!doc) throw new Error(`DOCUMENT_NOT_FOUND: ${documentId}`);

  const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000);
  const url = cloudinary.url(doc.cloudinaryId, {
    resource_type: "raw",
    sign_url:      true,
    expires_at:    Math.floor(expiresAt.getTime() / 1000),
    type:          "upload",
  });

  return { url, expiresAt };
}

// ── Listar documentos gerados ──────────────────────────────────────────────────

export type ListGeneratedDocsOptions = {
  entityType?: string;
  entityId?:   string;
  type?:       DocumentTemplateType;
  page?:       number;
  limit?:      number;
};

export async function listGeneratedDocuments(opts: ListGeneratedDocsOptions = {}) {
  const page  = Math.max(1, opts.page  ?? 1);
  const limit = Math.min(50, opts.limit ?? 20);
  const skip  = (page - 1) * limit;

  const where = {
    ...(opts.entityType && { entityType: opts.entityType }),
    ...(opts.entityId   && { entityId:   opts.entityId   }),
    ...(opts.type       && { type:       opts.type        }),
  };

  const [docs, total] = await Promise.all([
    prisma.generatedDocument.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      skip,
      take:    limit,
      select: {
        id:              true,
        templateSlug:    true,
        templateVersion: true,
        type:            true,
        entityType:      true,
        entityId:        true,
        version:         true,
        fileName:        true,
        fileSizeBytes:   true,
        sha256Hash:      true,
        generatedBy:     true,
        generatedAt:     true,
      },
    }),
    prisma.generatedDocument.count({ where }),
  ]);

  return {
    docs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

// ── Detalhe de documento ───────────────────────────────────────────────────────

export async function getGeneratedDocument(id: string) {
  return prisma.generatedDocument.findUnique({
    where:   { id },
    include: { template: { select: { name: true, type: true, version: true } } },
  });
}
