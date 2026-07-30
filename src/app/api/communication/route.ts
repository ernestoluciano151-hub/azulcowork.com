/**
 * GET /api/communication
 *
 * Lista paginada de CommunicationLog com filtros.
 *
 * Query params:
 *   page      (default 1)
 *   limit     (default 20, max 100)
 *   status    PENDING | SENT | FAILED | RETRYING
 *   type      EMAIL | WHATSAPP | WHATSAPP_DEEPLINK
 *   channel   transactional | alert | reminder | receipt | financial
 *   entityType  LEAD | RESERVATION | INVOICE | PAYMENT
 *   entityId
 *   from      ISO date (createdAt >=)
 *   to        ISO date (createdAt <=)
 *   q         full-text search no campo `to` (email/phone)
 *
 * Permissões: ADMIN ou FINANCEIRO
 * VOL07 — Sprint VOL07-2
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const authErr = await requireRole(req, ["ADMIN", "FINANCEIRO"]);
  if (authErr) return authErr;

  const sp = req.nextUrl.searchParams;

  const page  = Math.max(1, parseInt(sp.get("page")  ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20")));
  const skip  = (page - 1) * limit;

  const where: Prisma.CommunicationLogWhereInput = {};

  const status     = sp.get("status");
  const type       = sp.get("type");
  const channel    = sp.get("channel");
  const entityType = sp.get("entityType");
  const entityId   = sp.get("entityId");
  const from       = sp.get("from");
  const to         = sp.get("to");
  const q          = sp.get("q");

  if (status)     where.status     = status     as Prisma.EnumCommStatusFilter;
  if (type)       where.type       = type       as Prisma.EnumCommTypeFilter;
  if (channel)    where.channel    = channel;
  if (entityType) where.entityType = entityType;
  if (entityId)   where.entityId   = entityId;
  if (q)          where.to         = { contains: q, mode: "insensitive" };

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to)   where.createdAt.lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    prisma.communicationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id:           true,
        type:         true,
        channel:      true,
        templateSlug: true,
        to:           true,
        subject:      true,
        status:       true,
        attempts:     true,
        sentAt:       true,
        lastAttemptAt: true,
        errorMsg:     true,
        entityType:   true,
        entityId:     true,
        triggeredBy:  true,
        createdAt:    true,
      },
    }),
    prisma.communicationLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
