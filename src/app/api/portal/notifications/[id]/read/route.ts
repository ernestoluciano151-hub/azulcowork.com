/**
 * PATCH /api/portal/notifications/[id]/read
 *
 * Marca notificação como lida (status → READ, readAt = now()).
 * Idempotente: se já está READ retorna 200 sem erro.
 * Isolamento: portalUserId + companyId obrigatório.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { markAsRead }           from "@/lib/portal-notification-service";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { id } = await params;

    const updated = await markAsRead(id, user.sub, user.companyId);
    if (!updated) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/portal/notifications/[id]/read]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
