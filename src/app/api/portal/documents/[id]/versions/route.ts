/**
 * GET  /api/portal/documents/[id]/versions  — lista versões do documento
 * POST /api/portal/documents/[id]/versions  — adicionar nova versão (upload)
 *
 * Regra: versões são append-only — nunca apagar.
 * PORTAL_ADMIN ou superior para adicionar versão.
 * Isolamento: companyId obrigatório.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession, requirePortalRole } from "@/lib/portal-auth-service";
import { prisma }              from "@/lib/prisma";
import { PortalRole }          from "@prisma/client";
import { addDocumentVersion }  from "@/lib/portal-documents-service";

// ── GET — lista versões ────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { id } = await params;

    // Verificar que documento existe e pertence à empresa
    const doc = await prisma.portalDocument.findFirst({
      where: { id, companyId: user.companyId, isActive: true },
      select: { id: true, title: true, currentVersionId: true },
    });
    if (!doc) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    const versions = await prisma.portalDocumentVersion.findMany({
      where:   { documentId: id },
      orderBy: { version: "desc" },
      select: {
        id:            true,
        version:       true,
        mimeType:      true,
        sizeBytes:     true,
        changeNote:    true,
        uploadedByName:true,
        createdAt:     true,
        // cloudinaryPublicId — NUNCA exposto
      },
    });

    return NextResponse.json({
      data: {
        documentId:       doc.id,
        title:            doc.title,
        currentVersionId: doc.currentVersionId,
        versions,
      },
    });
  } catch (err) {
    console.error("[GET /api/portal/documents/[id]/versions]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}

// ── POST — nova versão ─────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_ADMIN);
    if (error) return error;

    const { id } = await params;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Pedido deve ser multipart/form-data." }, { status: 400 });
    }

    const file       = formData.get("file");
    const changeNote = formData.get("changeNote")?.toString()?.trim();

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Campo 'file' é obrigatório." }, { status: 400 });
    }

    const buffer   = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const filename = (file as File).name ?? "documento";

    let result: { versionId: string; versionNumber: number };
    try {
      result = await addDocumentVersion({
        documentId:     id,
        companyId:      user.companyId,
        buffer,
        mimeType,
        filename,
        changeNote,
        uploadedById:   user.sub,
        uploadedByName: user.name,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "DOCUMENT_NOT_FOUND") {
        return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
      }
      if (msg === "CLOUDINARY_NOT_CONFIGURED") {
        return NextResponse.json(
          { error: "Serviço de armazenamento temporariamente indisponível." },
          { status: 503 }
        );
      }
      if (msg.startsWith("Ficheiro")) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      throw err;
    }

    return NextResponse.json({
      ok:            true,
      versionId:     result.versionId,
      versionNumber: result.versionNumber,
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/portal/documents/[id]/versions]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
