/**
 * GET /api/portal/notifications
 *
 * Lista notificações IN_APP do utilizador autenticado.
 * Filtros: status, type, page, limit.
 * Inclui contagem de não lidas (para badge).
 * Isolamento: portalUserId + companyId obrigatório.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession }      from "@/lib/portal-auth-service";
import { prisma }                    from "@/lib/prisma";
import {
  NotificationStatus,
  OmnichannelType,
  PortalAlertType,
} from "@prisma/client";
import { getUnreadCount }            from "@/lib/portal-notification-service";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") as NotificationStatus | null;
    const type   = searchParams.get("type")   as PortalAlertType | null;
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
    const limit  = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));
    const skip   = (page - 1) * limit;

    const where = {
      portalUserId: user.sub,
      companyId:    user.companyId,
      channel:      OmnichannelType.IN_APP,  // portal só mostra IN_APP
      ...(status ? { status } : {}),
      ...(type   ? { type }   : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.portalNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take:    limit,
        select: {
          id:        true,
          type:      true,
          status:    true,
          title:     true,
          body:      true,
          actionUrl: true,
          readAt:    true,
          sentAt:    true,
          createdAt: true,
          // Referências opcionais
          invoiceId:  true,
          contractId: true,
          documentId: true,
          bookingId:  true,
        },
      }),
      prisma.portalNotification.count({ where }),
      getUnreadCount(user.sub, user.companyId),
    ]);

    return NextResponse.json({
      data:        notifications,
      unreadCount,
      pagination:  { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/portal/notifications]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
