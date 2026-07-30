/**
 * GET /api/portal/documents/[id]
 *
 * Detalhe de documento: metadata + versões + última versão.
 * Regra BR-PORT-003: regista acesso VIEW (assíncrono).
 * Regra BR-PORT-002: não expõe cloudinaryPublicId nem URL directa.
 * Isolamento: companyId obrigatório.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { prisma }               from "@/lib/prisma";
import { recordDocumentView }   from "@/lib/portal-documents-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { id } = await params;
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const doc = await prisma.portalDocument.findFirst({
      where: {
        id,
        companyId: user.companyId,  // isolamento multi-tenant
        isActive:  true,
      },
      select: {
        id:               true,
        title:            true,
        category:         true,
        description:      true,
        tags:             true,
        currentVersionId: true,
        uploadedByName:   true,
        createdAt:        true,
        updatedAt:        true,
        versions: {
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
        },
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    // Registar VIEW de forma assíncrona (não bloqueia resposta)
    recordDocumentView({
      documentId:   id,
      companyId:    user.companyId,
      portalUserId: user.sub,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: doc });
  } catch (err) {
    console.error("[GET /api/portal/documents/[id]]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
