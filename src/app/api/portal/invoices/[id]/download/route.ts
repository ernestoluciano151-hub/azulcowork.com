/**
 * POST /api/portal/invoices/[id]/download
 *
 * Gera URL assinada Cloudinary (TTL 15 min) para download do PDF da fatura.
 * Regra BR-PORT-002: NUNCA expor URL directa do Cloudinary.
 * Regra BR-PORT-003: Toda leitura/download é auditada em PortalDocumentAccess.
 *
 * Fluxo:
 * 1. Verificar sessão + isolamento (companyId)
 * 2. Buscar fatura + verificar que tem PDF
 * 3. Extrair publicId do Cloudinary
 * 4. Gerar URL assinada (TTL 15 min)
 * 5. Criar auditoria PortalDocumentAccess
 * 6. Criar TimelineEntry
 * 7. Retornar { url, expiresAt }
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { generateSignedUrl, extractPublicIdFromUrl } from "@/lib/portal-signed-url-service";
import { prisma } from "@/lib/prisma";
import { DocumentAccessAction, TimelineEventType } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { id } = await params;
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    // Buscar fatura com isolamento multi-tenant
    const invoice = await prisma.erpInvoice.findFirst({
      where: {
        id,
        companyId: user.companyId,  // isolamento
      },
      select: {
        id:      true,
        number:  true,
        pdfUrl:  true,
        company: { select: { name: true } },
      },
    });

    // 404 genérico — não revelar se pertence a outra empresa
    if (!invoice) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    // Verificar que o PDF foi gerado
    if (!invoice.pdfUrl) {
      return NextResponse.json(
        { error: "PDF ainda não disponível para esta fatura. Por favor tente mais tarde." },
        { status: 409 }
      );
    }

    // Extrair publicId do Cloudinary a partir da URL
    const publicId = extractPublicIdFromUrl(invoice.pdfUrl);
    if (!publicId) {
      console.error(`[Portal Download] Não foi possível extrair publicId de: ${invoice.pdfUrl}`);
      return NextResponse.json(
        { error: "Não foi possível gerar o link de download. Por favor contacte o suporte." },
        { status: 500 }
      );
    }

    // Gerar URL assinada (TTL 15 minutos)
    let signedUrlResult: { url: string; expiresAt: Date };
    try {
      signedUrlResult = generateSignedUrl(publicId, "raw");
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "CLOUDINARY_NOT_CONFIGURED") {
        console.error("[Portal Download] Cloudinary não configurado");
        return NextResponse.json(
          { error: "Serviço de download temporariamente indisponível." },
          { status: 503 }
        );
      }
      throw err;
    }

    // Auditoria + Timeline em paralelo (não bloqueia a resposta se falhar)
    Promise.all([
      // Registar acesso em PortalDocumentAccess
      prisma.portalDocumentAccess.create({
        data: {
          documentId:   id,   // usa invoiceId como referência (sem FK directa)
          portalUserId: user.sub,
          action:       DocumentAccessAction.DOWNLOAD,
          signedUrl:    signedUrlResult.url,
          urlExpiresAt: signedUrlResult.expiresAt,
          ipAddress,
          userAgent,
        },
      }).catch(auditErr => {
        // Falha de auditoria não deve bloquear o download — mas deve ser logada
        console.error("[Portal Download] Falha na auditoria:", auditErr);
      }),

      // TimelineEntry na empresa
      prisma.timelineEntry.create({
        data: {
          companyId:       user.companyId,
          eventType:       TimelineEventType.PORTAL_DOCUMENT_DOWNLOADED,
          title:           `Fatura ${invoice.number} descarregada`,
          description:     `Descarregado por ${user.name} (${user.email})`,
          actorId:         user.sub,
          actorName:       user.name,
          isSystem:        false,
          linkedEntityType:"ErpInvoice",
          linkedEntityId:  invoice.id,
          metadata: {
            invoiceNumber: invoice.number,
            portalUserId:  user.sub,
            portalUserRole:user.role,
          },
        },
      }).catch(timelineErr => {
        console.error("[Portal Download] Falha na timeline:", timelineErr);
      }),
    ]);

    return NextResponse.json({
      ok:        true,
      url:       signedUrlResult.url,
      expiresAt: signedUrlResult.expiresAt.toISOString(),
      filename:  `fatura-${invoice.number}.pdf`,
    });
  } catch (err) {
    console.error("[POST /api/portal/invoices/[id]/download]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
