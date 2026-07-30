/**
 * /api/crm/companies/:id/tasks/:taskId
 *
 * PATCH  — Actualizar task / marcar como concluída (ADMIN | COMERCIAL próprias)
 * DELETE — Soft-delete task (ADMIN | COMERCIAL próprias)
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse }   from "next/server";
import { AdminRole, TaskPriority, TaskStatus } from "@prisma/client";
import { requireRole }                 from "@/lib/auth";
import { isApiRateLimited }            from "@/lib/rateLimit";
import { prisma }                      from "@/lib/prisma";
import { publish }                     from "@/lib/event-bus";
import { sanitizeText }                from "@/lib/validators";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string; taskId: string }> };

const VALID_PRIORITIES = new Set(Object.values(TaskPriority));
const VALID_STATUSES   = new Set(Object.values(TaskStatus));

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-tasks-patch")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const { id, taskId } = await ctx.params;

  const existing = await prisma.crmTask.findFirst({
    where:  { id: taskId, companyId: id, deletedAt: null },
    select: { id: true, title: true, status: true, assignedToId: true },
  });
  if (!existing) return NextResponse.json({ error: "Task não encontrada." }, { status: 404 });

  // COMERCIAL só pode actualizar as suas tasks
  if (session!.role === AdminRole.COMERCIAL && existing.assignedToId !== session!.sub) {
    return NextResponse.json({ error: "Sem permissão para actualizar esta task." }, { status: 403 });
  }

  // Não reabrir tasks canceladas
  if (existing.status === TaskStatus.CANCELLED) {
    return NextResponse.json({ error: "Não é possível actualizar uma task cancelada." }, { status: 422 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const tracked: Record<string, unknown> = {};
  let completing = false;

  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = sanitizeText(body.title.trim()); tracked.title = updates.title;
  }
  if (typeof body.description === "string") {
    updates.description = sanitizeText(body.description.trim()) || null;
  }
  if (typeof body.priority === "string" && VALID_PRIORITIES.has(body.priority as TaskPriority)) {
    updates.priority = body.priority; tracked.priority = body.priority;
  }
  if (typeof body.dueDate === "string") {
    updates.dueDate = new Date(body.dueDate); tracked.dueDate = body.dueDate;
  }
  if (typeof body.assignedToId === "string" && session!.role === AdminRole.ADMIN) {
    updates.assignedToId = body.assignedToId; tracked.assignedToId = body.assignedToId;
  }

  // Status change
  const newStatus = typeof body.status === "string" && VALID_STATUSES.has(body.status as TaskStatus)
    ? (body.status as TaskStatus)
    : null;

  if (newStatus && newStatus !== existing.status) {
    updates.status = newStatus;
    tracked.status = newStatus;

    if (newStatus === TaskStatus.DONE) {
      updates.completedAt = new Date();
      completing = true;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para actualizar." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.crmTask.update({ where: { id: taskId }, data: updates });

      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     completing ? "COMPLETE" : "UPDATE",
          entityType: "CrmTask",
          entityId:   taskId,
          actorId:    session!.sub,
          ip,
          before: { status: existing.status, title: existing.title },
          after:  tracked,
        },
      });
    });
  } catch (err) {
    console.error("[PATCH /api/crm/.../tasks/:taskId]", err);
    return NextResponse.json({ error: "Erro interno ao actualizar task." }, { status: 500 });
  }

  if (completing) {
    publish("crm.task.completed", {
      taskId,
      companyId: id,
      title:     existing.title,
      actorId:   session!.sub,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { id, taskId } = await ctx.params;

  const existing = await prisma.crmTask.findFirst({
    where:  { id: taskId, companyId: id, deletedAt: null },
    select: { id: true, title: true, assignedToId: true },
  });
  if (!existing) return NextResponse.json({ error: "Task não encontrada." }, { status: 404 });

  if (session!.role === AdminRole.COMERCIAL && existing.assignedToId !== session!.sub) {
    return NextResponse.json({ error: "Sem permissão para eliminar esta task." }, { status: 403 });
  }

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.crmTask.update({ where: { id: taskId }, data: { deletedAt: now } });
      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "DELETE",
          entityType: "CrmTask",
          entityId:   taskId,
          actorId:    session!.sub,
          ip,
          before: { title: existing.title },
          after:  { deletedAt: now.toISOString() },
        },
      });
    });
  } catch (err) {
    console.error("[DELETE /api/crm/.../tasks/:taskId]", err);
    return NextResponse.json({ error: "Erro interno ao eliminar task." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
