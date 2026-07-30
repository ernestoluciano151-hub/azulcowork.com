/**
 * GET /api/crm/tasks/my
 *
 * Tasks atribuídas ao utilizador autenticado, ordenadas por prioridade e prazo.
 * COMERCIAL apenas vê as suas; ADMIN pode ver todas (usar /api/crm/tasks para admin).
 *
 * Suporta filtro por status (?status=PENDING) e empresa (?companyId=...).
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole, TaskStatus }      from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import "@/lib/bootstrap";

const VALID_STATUSES = new Set(Object.values(TaskStatus));

// Priority sort order (higher = more urgent)
const PRIORITY_ORDER: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const statusFilter    = searchParams.get("status");
  const companyIdFilter = searchParams.get("companyId");

  const where = {
    assignedToId: session!.sub,
    deletedAt:    null,
    ...(statusFilter && VALID_STATUSES.has(statusFilter as TaskStatus)
      ? { status: statusFilter as TaskStatus }
      : { status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } }),
    ...(companyIdFilter ? { companyId: companyIdFilter } : {}),
  };

  const tasks = await prisma.crmTask.findMany({
    where,
    select: {
      id: true, title: true, description: true, priority: true, status: true,
      dueDate: true, completedAt: true, dealId: true, contactId: true,
      createdAt: true,
      company: { select: { id: true, name: true } },
    },
    orderBy: [{ dueDate: "asc" }],
  });

  // Ordenação secundária por prioridade (Prisma não suporta ordenação por enum custom)
  const sorted = tasks.sort((a, b) => {
    // Primeiro: vencidas vs futuras
    const now = Date.now();
    const aOverdue = a.dueDate && a.dueDate.getTime() < now ? -1 : 1;
    const bOverdue = b.dueDate && b.dueDate.getTime() < now ? -1 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    // Segundo: prioridade
    return (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
  });

  const overdue = sorted.filter(
    (t) => t.dueDate && t.dueDate.getTime() < Date.now() && t.status !== TaskStatus.DONE
  ).length;

  return NextResponse.json({ data: sorted, meta: { total: sorted.length, overdue } });
}
