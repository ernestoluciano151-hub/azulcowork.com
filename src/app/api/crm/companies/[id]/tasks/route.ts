/**
 * /api/crm/companies/:id/tasks
 *
 * GET  — Lista tasks de uma empresa (ADMIN vê todas; COMERCIAL vê as suas)
 * POST — Cria nova task com follow-up automático opcional (ADMIN | COMERCIAL)
 *
 * Regra BR-CRM-010: tasks vencidas > 24h publicam crm.task.overdue.
 * O job diário (ver crm-event-handlers.ts) é responsável por essa publicação.
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole, TaskPriority, TaskStatus } from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { isApiRateLimited }          from "@/lib/rateLimit";
import { prisma }                    from "@/lib/prisma";
import { publish }                   from "@/lib/event-bus";
import { sanitizeText }              from "@/lib/validators";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_PRIORITIES = new Set(Object.values(TaskPriority));
const VALID_STATUSES   = new Set(Object.values(TaskStatus));

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(
    AdminRole.ADMIN, AdminRole.COMERCIAL
  );
  if (error) return error;

  const { id } = await ctx.params;
  const { searchParams } = req.nextUrl;

  const statusFilter = searchParams.get("status");

  // ADMIN vê todas; COMERCIAL só as suas
  const assigneeFilter = session!.role === AdminRole.ADMIN ? undefined : session!.sub;

  const where = {
    companyId: id,
    deletedAt: null,
    ...(assigneeFilter ? { assignedToId: assigneeFilter } : {}),
    ...(statusFilter && VALID_STATUSES.has(statusFilter as TaskStatus)
      ? { status: statusFilter as TaskStatus }
      : {}),
  };

  const tasks = await prisma.crmTask.findMany({
    where,
    select: {
      id: true, title: true, description: true, priority: true, status: true,
      dueDate: true, completedAt: true, assignedToId: true,
      dealId: true, contactId: true, createdById: true, createdAt: true, updatedAt: true,
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  return NextResponse.json({ data: tasks });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-tasks")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const { id } = await ctx.params;

  const company = await prisma.company.findFirst({
    where: { id, crmDeletedAt: null }, select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? sanitizeText(body.title.trim()) : "";
  if (!title) return NextResponse.json({ error: "O título da task é obrigatório." }, { status: 400 });

  const rawPriority = typeof body.priority === "string" ? body.priority : "MEDIUM";
  const priority = VALID_PRIORITIES.has(rawPriority as TaskPriority)
    ? (rawPriority as TaskPriority)
    : TaskPriority.MEDIUM;

  const dueDate     = typeof body.dueDate     === "string" ? new Date(body.dueDate) : undefined;
  const assignedToId = typeof body.assignedToId === "string" ? body.assignedToId : session!.sub;

  let task: { id: string; title: string };

  try {
    task = await prisma.$transaction(async (tx) => {
      const created = await tx.crmTask.create({
        data: {
          companyId:   id,
          title,
          description: typeof body.description === "string" ? sanitizeText(body.description.trim()) : undefined,
          priority,
          status:      TaskStatus.PENDING,
          dueDate,
          assignedToId,
          dealId:      typeof body.dealId    === "string" ? body.dealId    : undefined,
          contactId:   typeof body.contactId === "string" ? body.contactId : undefined,
          createdById: session!.sub,
        },
        select: { id: true, title: true },
      });

      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "CREATE",
          entityType: "CrmTask",
          entityId:   created.id,
          actorId:    session!.sub,
          ip,
          after: { title, priority, dueDate: dueDate?.toISOString(), assignedToId },
        },
      });

      return created;
    });
  } catch (err) {
    console.error("[POST /api/crm/.../tasks]", err);
    return NextResponse.json({ error: "Erro interno ao criar task." }, { status: 500 });
  }

  publish("crm.task.created", {
    taskId:      task.id,
    companyId:   id,
    title:       task.title,
    priority,
    dueDate:     dueDate?.toISOString(),
    assignedToId,
    actorId:     session!.sub,
    timestamp:   new Date().toISOString(),
  }).catch(() => {});

  return NextResponse.json({ ok: true, task }, { status: 201 });
}
