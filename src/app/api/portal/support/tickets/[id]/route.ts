/**
 * GET /api/portal/support/tickets/[id]
 *
 * Detalhe de ticket + mensagens públicas (isInternal=false filtrado).
 * Regra: mensagens internas do staff NUNCA expostas no portal.
 * Isolamento: companyId obrigatório.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { prisma }               from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { id } = await params;

    const ticket = await prisma.portalSupportTicket.findFirst({
      where: {
        id,
        companyId: user.companyId,  // isolamento multi-tenant
      },
      select: {
        id:          true,
        number:      true,
        subject:     true,
        category:    true,
        priority:    true,
        status:      true,
        slaDeadline: true,
        resolvedAt:  true,
        closedAt:    true,
        reopenedAt:  true,
        createdAt:   true,
        updatedAt:   true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        // Mensagens: NUNCA retornar isInternal=true
        messages: {
          where:   { isInternal: false },
          orderBy: { createdAt: "asc" },
          select: {
            id:          true,
            body:        true,
            senderType:  true,
            senderName:  true,
            attachments: true,
            createdAt:   true,
            // isInternal não incluído na resposta
            // senderId não incluído (privacidade interna)
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: ticket });
  } catch (err) {
    console.error("[GET /api/portal/support/tickets/[id]]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
