/**
 * POST /api/admin/documents/[id]/share-portal
 * body: { companyId: string, title?: string, category?: string, changeNote?: string }
 *
 * Publica um GeneratedDocument no portal do cliente:
 *  1. Carrega o GeneratedDocument (valida existência)
 *  2. Resolve companyId (do body, ou do ErpContract/Lead se omitido)
 *  3. Cria PortalDocument (se não existe para este companyId + mesmo cloudinaryId)
 *  4. Cria PortalDocumentVersion (versão 1 — o Cloudinary public_id é partilhado)
 *  5. AuditLog DOCUMENT_SHARED_PORTAL (fire-and-forget)
 *
 * Regra: Nunca cria PortalDocumentAccess — acesso é da responsabilidade do portal.
 * Permissões: ADMIN apenas
 * VOL08 — Sprint VOL08-2B
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole }               from "@/lib/rbac";
import { requireSession }            from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { recordAudit }               from "@/lib/audit-service";
import { getGeneratedDocument }      from "@/lib/document-generation-service";
import type { AuditAction }          from "@prisma/client";

const VALID_CATEGORIES = ["contrato","fatura-manual","declaracao","comprovante","guia","outro"] as const;

export async function POST(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authErr = await requireRole(req, ["ADMIN"]);
  if (authErr) return authErr;

  const { id } = await context.params;

  // 1. Carregar GeneratedDocument
  const doc = await getGeneratedDocument(id);
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    body = {};
  }

  const { companyId: companyIdBody, title, category, changeNote } = body as {
    companyId?:  string;
    title?:      string;
    category?:   string;
    changeNote?: string;
  };

  // 2. Resolver companyId
  let companyId = companyIdBody;
  if (!companyId) {
    if (doc.entityType === "COMPANY") {
      companyId = doc.entityId;
    } else if (doc.entityType === "ERPCONTRACT") {
      const contract = await prisma.erpContract.findUnique({
        where:  { id: doc.entityId },
        select: { companyId: true },
      });
      companyId = contract?.companyId;
    } else if (doc.entityType === "LEAD") {
      const lead = await prisma.lead.findUnique({
        where:  { id: doc.entityId },
        select: { leadCompanyId: true },
      });
      companyId = lead?.leadCompanyId ?? undefined;
    }
  }

  if (!companyId) {
    return NextResponse.json(
      { error: "companyId obrigatório — não foi possível determinar automaticamente" },
      { status: 400 }
    );
  }

  // Validar category
  const docCategory = (category as typeof VALID_CATEGORIES[number]) ?? "contrato";
  if (!VALID_CATEGORIES.includes(docCategory as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json(
      { error: `category inválida. Válidas: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  // Actor
  const session    = await requireSession(req);
  const actorId    = typeof session === "object" && "id"    in session ? String(session.id)    : "ADMIN";
  const actorEmail = typeof session === "object" && "email" in session ? String(session.email) : "unknown";
  const actorRole  = typeof session === "object" && "role"  in session ? String(session.role)  : "ADMIN";

  // 3+4. Criar PortalDocument + PortalDocumentVersion na mesma transacção
  const { portalDocument, portalVersion } = await prisma.$transaction(async (tx) => {
    const portalDoc = await tx.portalDocument.create({
      data: {
        companyId,
        title:         title ?? doc.fileName,
        category:      docCategory,
        description:   `Gerado automaticamente a partir de ${doc.template?.name ?? doc.templateSlug}`,
        tags:          [doc.type, "gerado-sistema"],
        isActive:      true,
        uploadedById:  actorId,
        uploadedByName: actorEmail,
      },
    });

    const portalVer = await tx.portalDocumentVersion.create({
      data: {
        documentId:         portalDoc.id,
        version:            1,
        cloudinaryPublicId: doc.cloudinaryId,   // partilha o mesmo public_id — sem duplicação
        mimeType:           "application/pdf",
        sizeBytes:          doc.fileSizeBytes,
        changeNote:         changeNote ?? "Documento gerado pelo sistema",
        uploadedById:       actorId,
        uploadedByName:     actorEmail,
      },
    });

    // Actualizar currentVersionId
    await tx.portalDocument.update({
      where: { id: portalDoc.id },
      data:  { currentVersionId: portalVer.id },
    });

    return { portalDocument: portalDoc, portalVersion: portalVer };
  });

  // 5. AuditLog — fire-and-forget
  void recordAudit({
    actor:    { id: actorId, role: actorRole, email: actorEmail },
    action:   "DOCUMENT_SHARED_PORTAL" as AuditAction,
    entity:   "GeneratedDocument",
    entityId: id,
    entityRef: doc.fileName,
    after: {
      portalDocumentId:      portalDocument.id,
      portalDocumentVersion: portalVersion.id,
      companyId,
    },
  }).catch((err: unknown) => {
    console.error("[share-portal] AuditLog falhou:", err);
  });

  return NextResponse.json(
    {
      message:         "Documento partilhado no portal com sucesso.",
      portalDocumentId:      portalDocument.id,
      portalDocumentVersionId: portalVersion.id,
      companyId,
    },
    { status: 201 }
  );
}
