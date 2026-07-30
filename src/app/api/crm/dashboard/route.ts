/**
 * GET /api/crm/dashboard
 *
 * KPIs do CRM em tempo real.
 * ADMIN vê toda a base; COMERCIAL vê apenas as empresas que lhe estão atribuídas.
 *
 * Resposta:
 *  companies   — total activo + distribuição por pipelineStage + por crmStatus
 *  pipeline    — deals activos por stage + valor total por stage (AOA)
 *  performance — deals WON (30d, 90d, total) + taxa de conversão + ciclo médio em dias
 *  tasks       — total pendentes, em curso e vencidas (do utilizador ou globais)
 *  activities  — últimas 7 actividades (resumo)
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole, DealStage, TaskStatus } from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import "@/lib/bootstrap";

export async function GET(_req: NextRequest) {
  const { session, error } = await requireRole(
    AdminRole.ADMIN,
    AdminRole.COMERCIAL,
    AdminRole.FINANCEIRO,
  );
  if (error) return error;

  const isAdmin     = session!.role === AdminRole.ADMIN || session!.role === AdminRole.FINANCEIRO;
  const userId      = session!.sub;

  // Filtro base de empresa: ADMIN vê tudo; COMERCIAL vê só as suas
  const companyFilter = {
    crmDeletedAt:  null,
    crmStatus:     { not: "MERGED" as const },
    pipelineStage: { not: null },
    ...(!isAdmin ? { assignedToId: userId } : {}),
  };

  // Filtro base de deal
  const dealFilter = {
    deletedAt: null,
    company:   { ...companyFilter },
  };

  // ── 1. Empresas ──────────────────────────────────────────────────────────────

  const [companiesTotal, companiesByStage, companiesByStatus] = await Promise.all([
    prisma.company.count({ where: companyFilter }),

    prisma.company.groupBy({
      by:     ["pipelineStage"],
      where:  companyFilter,
      _count: { id: true },
    }),

    prisma.company.groupBy({
      by:     ["crmStatus"],
      where:  companyFilter,
      _count: { id: true },
    }),
  ]);

  // ── 2. Pipeline de deals ─────────────────────────────────────────────────────

  const [dealsByStage, dealsValueByStage] = await Promise.all([
    prisma.crmDeal.groupBy({
      by:     ["stage"],
      where:  { ...dealFilter, stage: { notIn: [DealStage.WON, DealStage.LOST] } },
      _count: { id: true },
    }),

    prisma.crmDeal.groupBy({
      by:     ["stage"],
      where:  { ...dealFilter, stage: { notIn: [DealStage.WON, DealStage.LOST] }, value: { not: null } },
      _sum:   { value: true },
    }),
  ]);

  // Mapa stage → { count, totalValue }
  const pipelineMap: Record<string, { count: number; totalValue: number }> = {};
  for (const row of dealsByStage) {
    pipelineMap[row.stage] = { count: row._count.id, totalValue: 0 };
  }
  for (const row of dealsValueByStage) {
    if (pipelineMap[row.stage]) {
      pipelineMap[row.stage].totalValue = row._sum.value ?? 0;
    }
  }

  const pipelineTotalValue = Object.values(pipelineMap).reduce((s, r) => s + r.totalValue, 0);

  // ── 3. Performance ───────────────────────────────────────────────────────────

  const now   = new Date();
  const d30   = new Date(now); d30.setDate(now.getDate() - 30);
  const d90   = new Date(now); d90.setDate(now.getDate() - 90);

  const [wonTotal, won30d, won90d, wonValue, totalClosed] = await Promise.all([
    prisma.crmDeal.count({ where: { ...dealFilter, stage: DealStage.WON } }),
    prisma.crmDeal.count({ where: { ...dealFilter, stage: DealStage.WON, closedAt: { gte: d30 } } }),
    prisma.crmDeal.count({ where: { ...dealFilter, stage: DealStage.WON, closedAt: { gte: d90 } } }),
    prisma.crmDeal.aggregate({
      where: { ...dealFilter, stage: DealStage.WON, value: { not: null } },
      _sum:  { value: true },
    }),
    prisma.crmDeal.count({
      where: { ...dealFilter, stage: { in: [DealStage.WON, DealStage.LOST] } },
    }),
  ]);

  // Taxa de conversão: WON / (WON + LOST)
  const conversionRate = totalClosed > 0
    ? Math.round((wonTotal / totalClosed) * 100)
    : null;

  // Ciclo médio: média de (closedAt - createdAt) para deals WON com ambas as datas
  const wonWithDates = await prisma.crmDeal.findMany({
    where:  { ...dealFilter, stage: DealStage.WON, closedAt: { not: null } },
    select: { createdAt: true, closedAt: true },
    take:   200, // limitar para performance
  });
  const avgCycleDays = wonWithDates.length > 0
    ? Math.round(
        wonWithDates.reduce((sum, d) => {
          const days = (d.closedAt!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / wonWithDates.length
      )
    : null;

  // ── 4. Tasks ─────────────────────────────────────────────────────────────────

  const taskFilter = {
    deletedAt:    null,
    status:       { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] as TaskStatus[] },
    ...(!isAdmin ? { assignedToId: userId } : {}),
  };

  const [tasksPending, tasksInProgress, tasksOverdue] = await Promise.all([
    prisma.crmTask.count({ where: { ...taskFilter, status: TaskStatus.PENDING } }),
    prisma.crmTask.count({ where: { ...taskFilter, status: TaskStatus.IN_PROGRESS } }),
    prisma.crmTask.count({ where: { ...taskFilter, dueDate: { lt: now }, status: { not: TaskStatus.DONE } } }),
  ]);

  // ── 5. Últimas actividades ───────────────────────────────────────────────────

  const recentActivities = await prisma.crmActivity.findMany({
    where:   { company: { ...companyFilter } },
    select:  {
      id:        true,
      type:      true,
      direction: true,
      summary:   true,
      occurredAt: true,
      company:   { select: { id: true, name: true } },
    },
    orderBy: { occurredAt: "desc" },
    take:    7,
  });

  // ── Resposta ─────────────────────────────────────────────────────────────────

  return NextResponse.json({
    generatedAt: now.toISOString(),
    scope:       isAdmin ? "global" : "personal",

    companies: {
      total:      companiesTotal,
      byStage:    Object.fromEntries(
        companiesByStage.map((r) => [r.pipelineStage ?? "null", r._count.id])
      ),
      byStatus:   Object.fromEntries(
        companiesByStatus.map((r) => [r.crmStatus ?? "null", r._count.id])
      ),
    },

    pipeline: {
      byStage:    pipelineMap,
      totalValue: pipelineTotalValue,
      currency:   "AOA",
    },

    performance: {
      wonTotal,
      won30d,
      won90d,
      wonValueAOA:     wonValue._sum.value ?? 0,
      conversionRate,  // %, null se sem deals fechados
      avgCycleDays,    // null se sem dados
    },

    tasks: {
      pending:    tasksPending,
      inProgress: tasksInProgress,
      overdue:    tasksOverdue,
    },

    recentActivities,
  });
}
