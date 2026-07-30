/**
 * POST /api/portal/support/tickets/[id]/close
 *
 * Fechar ticket (PORTAL_MEMBER+).
 * Qualquer utilizador pode fechar tickets da sua empresa.
 * Estados permitidos: OPEN | IN_PROGRESS | WAITING | RESOLVED
 * Ticket CLOSED não pode ser fechado novamente.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalRole } from "@/lib/portal-auth-service";
import { PortalRole }        from "@prisma/client";
import { closeTicket }       from "@/lib/portal-support-service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_MEMBER);
    if (error) return error;

    const { id } = await params;

    try {
      await closeTicket({
        ticketId:     id,
        companyId:    user.companyId,
        closedById:   user.sub,
        closedByName: user.name,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "TICKET_NOT_FOUND") {
        return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
      }
      if (msg === "TICKET_CANNOT_CLOSE") {
        return NextResponse.json(
          { error: "Este ticket não pode ser fechado no estado actual." },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({ ok: true, message: "Ticket fechado com sucesso." });
  } catch (err) {
    console.error("[POST /api/portal/support/tickets/[id]/close]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
