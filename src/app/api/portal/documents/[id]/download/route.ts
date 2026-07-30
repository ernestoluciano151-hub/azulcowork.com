/**
 * POST /api/portal/documents/[id]/download
 *
 * Gera URL assinada Cloudinary (TTL 15 min) para download da versão actual.
 * Regra BR-PORT-002: NUNCA expor cloudinaryPublicId ou URL directa.
 * Regra BR-PORT-003: regista PortalDocumentAccess (DOWNLOAD) + TimelineEntry.
 *
 * Body (opcional): { versionId?: string }  — se omitido, usa versão actual
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession }        from "@/lib/portal-auth-service";
import { generateDocumentDownloadUrl } from "@/lib/portal-documents-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { id } = await params;
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    // versionId opcional no body
    let versionId: string | undefined;
    try {
      const body = await req.json();
      if (body?.versionId && typeof body.versionId === "string") {
        versionId = body.versionId;
      }
    } catch {
      // body vazio ou não-JSON — usa versão actual
    }

    let result: { url: string; expiresAt: Date; filename: string; versionId: string };
    try {
      result = await generateDocumentDownloadUrl({
        documentId:      id,
        companyId:       user.companyId,
        portalUserId:    user.sub,
        portalUserName:  user.name,
        portalUserEmail: user.email,
        ipAddress,
        userAgent,
        versionId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "DOCUMENT_NOT_FOUND") {
        return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
      }
      if (msg === "NO_VERSION_AVAILABLE") {
        return NextResponse.json(
          { error: "Documento ainda não tem versões disponíveis para download." },
          { status: 409 }
        );
      }
      if (msg === "VERSION_NOT_FOUND") {
        return NextResponse.json({ error: "Versão não encontrada." }, { status: 404 });
      }
      if (msg === "CLOUDINARY_NOT_CONFIGURED") {
        return NextResponse.json(
          { error: "Serviço de download temporariamente indisponível." },
          { status: 503 }
        );
      }
      throw err;
    }

    return NextResponse.json({
      ok:        true,
      url:       result.url,
      expiresAt: result.expiresAt.toISOString(),
      filename:  result.filename,
      versionId: result.versionId,
    });
  } catch (err) {
    console.error("[POST /api/portal/documents/[id]/download]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
