/**
 * POST /api/portal/support/tickets/[id]/messages
 *
 * Adicionar mensagem a um ticket (PORTAL_MEMBER+).
 * Regra: cliente não pode criar mensagens isInternal=true.
 * Se ticket estava WAITING e cliente responde → status muda para IN_PROGRESS.
 * Isolamento: companyId obrigatório.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalRole }         from "@/lib/portal-auth-service";
import { PortalRole, SupportMessageSender } from "@prisma/client";
import { addTicketMessage }          from "@/lib/portal-support-service";
import { z }                         from "zod";

const messageSchema = z.object({
  body:        z.string().min(1).max(5000),
  attachments: z.array(z.string().url()).max(5).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_MEMBER);
    if (error) return error;

    const { id } = await params;

    const body = await req.json();
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    let messageId: string;
    try {
      messageId = await addTicketMessage({
        ticketId:    id,
        companyId:   user.companyId,
        body:        parsed.data.body,
        senderType:  SupportMessageSender.CLIENT,
        senderId:    user.sub,
        senderName:  user.name,
        attachments: parsed.data.attachments,
        isInternal:  false,  // portal nunca cria mensagens internas
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "TICKET_NOT_FOUND") {
        return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
      }
      if (msg === "TICKET_CLOSED") {
        return NextResponse.json(
          { error: "Não é possível responder a um ticket fechado." },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({ ok: true, messageId }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/portal/support/tickets/[id]/messages]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
