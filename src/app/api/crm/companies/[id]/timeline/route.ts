/**
 * GET /api/crm/companies/:id/timeline
 *
 * Historial cronológico (append-only) de uma empresa — Customer 360°.
 * Suporta paginação, filtro por eventType e intervalo de datas.
 *
 * Acesso: todos os utilizadores autenticados (ADMIN | COMERCIAL | FINANCEIRO | VIEWER)
 * Docs: docs/04-crm/api.md
 */

import { NextRequest, NextResponse }  from "next/server";
import { TimelineEventType }          from "@prisma/client";
import { requireSession }             from "@/lib/auth";
import { prisma }                     from "@/lib/prisma";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_EVENT_TYPES = new Set(Object.values(TimelineEventType));

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await ctx.params;

  // Verificar que a empresa existe e não está soft-deleted
  const company = await prisma.company.findFirst({
    where:  { id, crmDeletedAt: null },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const { searchParams } = req.nextUrl;

  // Paginação
  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
  const skip     = (page - 1) * pageSize;

  // Filtro por tipo de evento (aceita múltiplos: ?eventType=DEAL_WON&eventType=DEAL_LOST)
  const rawTypes = searchParams.getAll("eventType");
  const eventTypes = rawTypes.filter((t): t is TimelineEventType =>
    VALID_EVENT_TYPES.has(t as TimelineEventType)
  );

  // Filtro por intervalo de datas
  const fromStr = searchParams.get("from");
  const toStr   = searchParams.get("to");
  const from    = fromStr ? new Date(fromStr) : undefined;
  const to      = toStr   ? new Date(toStr)   : undefined;

  // Filtro isSystem
  const isSystemStr = searchParams.get("isSystem");
  const isSystem    = isSystemStr === "true" ? true : isSystemStr === "false" ? false : undefined;

  const where = {
    companyId: id,
    ...(eventTypes.length > 0 ? { eventType: { in: eventTypes } } : {}),
    ...(from || to ? {
      occurredAt: {
        ...(from ? { gte: from } : {}),
        ...(to   ? { lte: to   } : {}),
      },
    } : {}),
    ...(isSystem !== undefined ? { isSystem } : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.timelineEntry.count({ where }),
    prisma.timelineEntry.findMany({
      where,
      select: {
        id:               true,
        eventType:        true,
        title:            true,
        description:      true,
        metadata:         true,
        actorId:          true,
        actorName:        true,
        isSystem:         true,
        linkedEntityType: true,
        linkedEntityId:   true,
        occurredAt:       true,
        createdAt:        true,
      },
      orderBy: { occurredAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    data: entries,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
