/**
 * POST /api/portal/notifications/read-all
 *
 * Marca todas as notificações IN_APP do utilizador como lidas.
 * Bulk update — PENDING, SENT, DELIVERED → READ.
 * Retorna contagem de notificações actualizadas.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { markAllAsRead }        from "@/lib/portal-notification-service";

export async function POST(_req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const count = await markAllAsRead(user.sub, user.companyId);

    return NextResponse.json({ ok: true, markedAsRead: count });
  } catch (err) {
    console.error("[POST /api/portal/notifications/read-all]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
