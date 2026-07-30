/**
 * GET /api/admin/documents/[id] — detalhe + URL assinada de download (TTL 15 min)
 *
 * Retorna o GeneratedDocument completo + downloadUrl temporária.
 * O AuditLog DOCUMENT_DOWNLOADED e Timeline são criados aqui (condição PO).
 *
 * Permissões: ADMIN, COMERCIAL
 * VOL08 — Sprint VOL08-2B
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole }               from "@/lib/rbac";
import { requireSession }            from "@/lib/auth";
import {
  getGeneratedDocument,
  getDocumentDownloadUrl,
}                                    from "@/lib/document-generation-service";
import { recordAudit }               from "@/lib/audit-service";
import { prisma }                    from "@/lib/prisma";
import type { AuditAction }          from "@prisma/client";

export async function GET(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authErr = await requireRole(req, ["ADMIN", "COMERCIAL"]);
  if (authErr) return authErr;

  const { id } = await context.params;

  const doc = await getGeneratedDocument(id);
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  // URL assinada temporária — TTL 15 min (condição PO)
  const { url: downloadUrl, expiresAt } = await getDocumentDownloadUrl(id);

  // AuditLog DOCUMENT_DOWNLOADED — fire-and-forget (condição PO)
  const session    = await requireSession(req);
  const actorId    = typeof session === "object" && "id"    in session ? String(session.id)    : "ADMIN";
  const actorEmail = typeof session === "object" && "email" in session ? String(session.email) : "unknown";
  const actorRole  = typeof session === "object" && "role"  in session ? String(session.role)  : "ADMIN";

  void recordAudit({
    actor:    { id: actorId, role: actorRole, email: actorEmail },
    action:   "DOCUMENT_DOWNLOADED" as AuditAction,
    entity:   "GeneratedDocument",
    entityId: id,
    entityRef: doc.fileName,
    metadata: { entityType: doc.entityType, entityId: doc.entityId, version: doc.version },
  }).catch((err: unknown) => {
    console.error("[GET /api/admin/documents/[id]] AuditLog falhou:", err);
  });

  // Timeline — fire-and-forget (condição PO)
  void logDownloadTimeline(doc.entityType, doc.entityId, doc.fileName, actorId).catch(() => {});

  return NextResponse.json({
    document:    doc,
    downloadUrl,
    expiresAt,
  });
}

async function logDownloadTimeline(
  entityType: string,
  entityId:   string,
  fileName:   string,
  actorId:    string
): Promise<void> {
  if (entityType === "LEAD") {
    await prisma.timeline.create({
      data: {
        leadId:        entityId,
        type:          "DOCUMENT_DOWNLOADED",
        title:         `Download: ${fileName}`,
        referenceType: "GeneratedDocument",
        createdBy:     actorId,
      },
    });
  } else {
    let companyId: string | undefined;
    if (entityType === "ERPCONTRACT") {
      const c = await prisma.erpContract.findUnique({ where: { id: entityId }, select: { companyId: true } });
      companyId = c?.companyId;
    } else if (entityType === "COMPANY") {
      companyId = entityId;
    }
    if (companyId) {
      await prisma.timeline.create({
        data: {
          companyId,
          type:          "DOCUMENT_DOWNLOADED",
          title:         `Download: ${fileName}`,
          referenceType: "GeneratedDocument",
          createdBy:     actorId,
        },
      });
    }
  }
}
