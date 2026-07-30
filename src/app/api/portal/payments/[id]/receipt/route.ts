/**
 * POST /api/portal/payments/[id]/receipt
 *
 * Gera URL assinada Cloudinary (TTL 15 min) para download do recibo PDF.
 * Regra BR-PORT-002: NUNCA expor URL directa do Cloudinary.
 * Regra BR-PORT-003: Toda leitura/download é auditada.
 *
 * Fluxo:
 * 1. Verificar sessão + isolamento (companyId)
 * 2. Buscar pagamento + verificar que tem recibo PDF
 * 3. Extrair publicId do Cloudinary
 * 4. Gerar URL assinada (TTL 15 min)
 * 5. Criar auditoria PortalDocumentAccess + TimelineEntry (async)
 * 6. Retornar { url, expiresAt, filename }
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

    // Buscar pagamento com isolamento
    const payment = await prisma.erpPayment.findFirst({
      where: {
        id,
        companyId: user.companyId,  // isolamento multi-tenant
        status:    "CONFIRMED",
      },
      select: {
        id:            true,
        receiptNumber: true,
        receiptUrl:    true,
        amount:        true,
        paidAt:        true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    if (!payment.receiptUrl) {
      return NextResponse.json(
        { error: "Recibo ainda não disponível para este pagamento. Por favor tente mais tarde." },
        { status: 409 }
      );
    }

    // Extrair publicId do Cloudinary
    const publicId = extractPublicIdFromUrl(payment.receiptUrl);
    if (!publicId) {
      console.error(`[Portal Receipt] Não foi possível extrair publicId de: ${payment.receiptUrl}`);
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
        return NextResponse.json(
          { error: "Serviço de download temporariamente indisponível." },
          { status: 503 }
        );
      }
      throw err;
    }

    const receiptLabel = payment.receiptNumber ?? id;

    // Auditoria + Timeline async
    Promise.all([
      prisma.portalDocumentAccess.create({
        data: {
          documentId:   id,
          portalUserId: user.sub,
          action:       DocumentAccessAction.DOWNLOAD,
          signedUrl:    signedUrlResult.url,
          urlExpiresAt: signedUrlResult.expiresAt,
          ipAddress,
          userAgent,
        },
      }).catch(e => console.error("[Portal Receipt] Falha auditoria:", e)),

      prisma.timelineEntry.create({
        data: {
          companyId:       user.companyId,
          eventType:       TimelineEventType.PORTAL_DOCUMENT_DOWNLOADED,
          title:           `Recibo ${receiptLabel} descarregado`,
          description:     `Descarregado por ${user.name} (${user.email})`,
          actorId:         user.sub,
          actorName:       user.name,
          isSystem:        false,
          linkedEntityType:"ErpPayment",
          linkedEntityId:  payment.id,
          metadata: {
            receiptNumber: payment.receiptNumber,
            amount:        payment.amount,
            paidAt:        payment.paidAt,
            portalUserId:  user.sub,
          },
        },
      }).catch(e => console.error("[Portal Receipt] Falha timeline:", e)),
    ]);

    return NextResponse.json({
      ok:        true,
      url:       signedUrlResult.url,
      expiresAt: signedUrlResult.expiresAt.toISOString(),
      filename:  `recibo-${receiptLabel}.pdf`,
    });
  } catch (err) {
    console.error("[POST /api/portal/payments/[id]/receipt]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
