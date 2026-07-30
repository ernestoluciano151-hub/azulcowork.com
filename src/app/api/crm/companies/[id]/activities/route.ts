/**
 * /api/crm/companies/:id/activities
 *
 * GET  — Lista actividades de uma empresa, ordenadas por occurredAt DESC
 * POST — Regista nova actividade (ADMIN | COMERCIAL)
 *        Publica evento no Event Bus → Timeline Handler escreve TimelineEntry
 *
 * Docs: docs/04-crm/api.md
 */

import { NextRequest, NextResponse }       from "next/server";
import { AdminRole, ActivityType, ActivityDirection } from "@prisma/client";
import { requireSession, requireRole }     from "@/lib/auth";
import { isApiRateLimited }               from "@/lib/rateLimit";
import { prisma }                         from "@/lib/prisma";
import { publish }                        from "@/lib/event-bus";
import { sanitizeText }                   from "@/lib/validators";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_TYPES      = new Set(Object.values(ActivityType));
const VALID_DIRECTIONS = new Set(Object.values(ActivityDirection));

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await ctx.params;

  const company = await prisma.company.findFirst({
    where: { id, crmDeletedAt: null }, select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
  const pageSize = Math.min(50,  Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
  const typeFilter = searchParams.get("type");

  const where = {
    companyId: id,
    ...(typeFilter && VALID_TYPES.has(typeFilter as ActivityType)
      ? { type: typeFilter as ActivityType }
      : {}),
  };

  const [total, activities] = await Promise.all([
    prisma.crmActivity.count({ where }),
    prisma.crmActivity.findMany({
      where,
      select: {
        id: true, type: true, direction: true, title: true,
        description: true, durationMin: true, contactId: true,
        dealId: true, createdById: true, occurredAt: true, createdAt: true,
      },
      orderBy: { occurredAt: "desc" },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
  ]);

  return NextResponse.json({ data: activities, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-activities")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const { id } = await ctx.params;

  const company = await prisma.company.findFirst({
    where: { id, crmDeletedAt: null }, select: { id: true, name: true },
  });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? sanitizeText(body.title.trim()) : "";
  if (!title) return NextResponse.json({ error: "O título da actividade é obrigatório." }, { status: 400 });

  const rawType = typeof body.type === "string" ? body.type : "";
  if (!VALID_TYPES.has(rawType as ActivityType)) {
    return NextResponse.json({ error: `Tipo inválido. Valores aceites: ${[...VALID_TYPES].join(", ")}.` }, { status: 400 });
  }

  const rawDir = typeof body.direction === "string" ? body.direction : "OUTBOUND";
  const direction = VALID_DIRECTIONS.has(rawDir as ActivityDirection)
    ? (rawDir as ActivityDirection)
    : ActivityDirection.OUTBOUND;

  const occurredAt = typeof body.occurredAt === "string" ? new Date(body.occurredAt) : new Date();

  let activity: { id: string };

  try {
    activity = await prisma.$transaction(async (tx) => {
      const created = await tx.crmActivity.create({
        data: {
          companyId:   id,
          type:        rawType as ActivityType,
          direction,
          title,
          description: typeof body.description === "string" ? sanitizeText(body.description.trim()) : undefined,
          durationMin: typeof body.durationMin  === "number" ? body.durationMin : undefined,
          contactId:   typeof body.contactId    === "string" ? body.contactId    : undefined,
          dealId:      typeof body.dealId       === "string" ? body.dealId       : undefined,
          createdById: session!.sub,
          occurredAt,
        },
        select: { id: true },
      });

      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "CREATE",
          entityType: "CrmActivity",
          entityId:   created.id,
          actorId:    session!.sub,
          ip,
          after: { type: rawType, direction, title, occurredAt: occurredAt.toISOString() },
        },
      });

      return created;
    });
  } catch (err) {
    console.error("[POST /api/crm/.../activities]", err);
    return NextResponse.json({ error: "Erro interno ao registar actividade." }, { status: 500 });
  }

  publish("crm.activity.created", {
    activityId: activity.id,
    companyId:  id,
    type:       rawType,
    direction,
    title,
    actorId:    session!.sub,
    timestamp:  new Date().toISOString(),
  }).catch(() => {});

  return NextResponse.json({ ok: true, activity }, { status: 201 });
}
