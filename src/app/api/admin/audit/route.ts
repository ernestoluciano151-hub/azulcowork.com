import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit
 *
 * Lista o log de auditoria com filtros e paginação.
 * Acesso restrito a ADMIN.
 *
 * Query params:
 *   actorId    — filtrar por utilizador
 *   action     — AuditAction específico
 *   entity     — ex: "Payment", "AdminUser"
 *   entityId   — id da entidade
 *   from       — ISO datetime (createdAt >=)
 *   to         — ISO datetime (createdAt <=)
 *   page       — default 1
 *   limit      — default 50, max 200
 */
export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const actorId  = searchParams.get("actorId");
  const action   = searchParams.get("action");
  const entity   = searchParams.get("entity");
  const entityId = searchParams.get("entityId");
  const from     = searchParams.get("from");
  const to       = searchParams.get("to");
  const page     = Math.max(1, parseInt(searchParams.get("page")  || "1",  10));
  const limit    = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (actorId)  where.actorId  = actorId;
  if (action)   where.action   = action;
  if (entity)   where.entity   = entity;
  if (entityId) where.entityId = entityId;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to)   where.createdAt.lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * limit,
      take:    limit,
      select: {
        id:         true,
        actorId:    true,
        actorRole:  true,
        actorEmail: true,
        action:     true,
        entity:     true,
        entityId:   true,
        entityRef:  true,
        before:     true,
        after:      true,
        ipAddress:  true,
        userAgent:  true,
        metadata:   true,
        createdAt:  true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
