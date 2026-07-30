/**
 * POST /api/portal/support/tickets/[id]/reopen
 *
 * Reabrir ticket (PORTAL_MEMBER+).
 * Condições: status = RESOLVED e resolvedAt há ≤ 30 dias.
 * Ticket passa a OPEN e resolvedAt é limpo.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalRole } from "@/lib/portal-auth-service";
import { PortalRole }        from "@prisma/client";
import { reopenTicket }      from "@/lib/portal-support-service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_MEMBER);
    if (error) return error;

    const { id } = await params;

    try {
      await reopenTicket({
        ticketId:       id,
        companyId:      user.companyId,
        reopenedById:   user.sub,
        reopenedByName: user.name,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "TICKET_NOT_FOUND") {
        return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
      }
      if (msg === "TICKET_NOT_RESOLVED") {
        return NextResponse.json(
          { error: "Só é possível reabrir tickets com estado 'Resolvido'." },
          { status: 409 }
        );
      }
      if (msg === "TICKET_REOPEN_EXPIRED") {
        return NextResponse.json(
          { error: "Não é possível reabrir o ticket após 30 dias da resolução. Por favor crie um novo ticket." },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({ ok: true, message: "Ticket reaberto com sucesso." });
  } catch (err) {
    console.error("[POST /api/portal/support/tickets/[id]/reopen]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
