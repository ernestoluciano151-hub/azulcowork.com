/**
 * GET /api/crm/pipeline
 *
 * Vista Kanban do pipeline CRM — empresas agrupadas por pipelineStage.
 * Inclui deals activos e contacto primário por empresa.
 *
 * Query params:
 *   stages   — filtrar stages específicos (CSV); ex: NEW_LEAD,CONTACTED
 *   assignee — filtrar por assignedToId (ADMIN only)
 *   search   — filtrar por nome de empresa (parcial, case-insensitive)
 *
 * ADMIN vê todas as empresas; COMERCIAL vê apenas as suas.
 *
 * Resposta: { columns: [ { stage, companies: [...] } ] }
 * Cada empresa inclui: id, name, nif, crmStatus, assignedToId,
 *   deals (activos, com value total), primaryContact, taskCount, lastActivity.
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/ux.md
 */

import { NextRequest, NextResponse }   from "next/server";
import { AdminRole, PipelineStage }    from "@prisma/client";
import { requireRole }                 from "@/lib/auth";
import { prisma }                      from "@/lib/prisma";
import "@/lib/bootstrap";

// Stages activos do Kanban (excluímos WON e LOST das colunas por defeito)
const KANBAN_STAGES: PipelineStage[] = [
  PipelineStage.NEW_LEAD,
  PipelineStage.CONTACTED,
  PipelineStage.QUALIFIED,
  PipelineStage.PROPOSAL_SENT,
  PipelineStage.NEGOTIATION,
];

const VALID_STAGES = new Set(Object.values(PipelineStage));

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const isAdmin = session!.role === AdminRole.ADMIN;
  const userId  = session!.sub;

  const { searchParams } = req.nextUrl;

  // Filtros opcionais
  const stagesParam = searchParams.get("stages");
  const assigneeParam = searchParams.get("assignee");
  const search = searchParams.get("search")?.trim() ?? "";

  // Parse stages
  let requestedStages: PipelineStage[] = KANBAN_STAGES;
  if (stagesParam) {
    const parsed = stagesParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s): s is PipelineStage => VALID_STAGES.has(s as PipelineStage));
    if (parsed.length > 0) requestedStages = parsed;
  }

  // Incluir WON/LOST se explicitamente pedidos
  const includeWon  = requestedStages.includes(PipelineStage.WON);
  const includeLost = requestedStages.includes(PipelineStage.LOST);

  // Filtro base de empresa
  const companyWhere = {
    crmDeletedAt:   null,
    crmStatus:      { not: "MERGED" as const },
    pipelineStage:  { in: requestedStages },
    ...(!isAdmin ? { assignedToId: userId } : {}),
    ...(isAdmin && assigneeParam ? { assignedToId: assigneeParam } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };

  // Buscar todas as empresas das colunas pedidas
  const companies = await prisma.company.findMany({
    where:   companyWhere,
    select: {
      id:            true,
      name:          true,
      nif:           true,
      crmStatus:     true,
      pipelineStage: true,
      assignedToId:  true,
      sector:        true,
      country:       true,
      createdAt:     true,
      // Deals activos (não terminais)
      crmDeals: {
        where:   { deletedAt: null, stage: { notIn: ["WON", "LOST"] } },
        select:  { id: true, title: true, stage: true, value: true, expectedClose: true },
        orderBy: { createdAt: "desc" },
        take:    5,
      },
      // Contacto primário
      crmContacts: {
        where:   { deletedAt: null, isPrimary: true },
        select:  { id: true, firstName: true, lastName: true, email: true, phone: true },
        take:    1,
      },
      // Contagem de tasks pendentes
      crmTasks: {
        where:  { deletedAt: null, status: { in: ["PENDING", "IN_PROGRESS"] } },
        select: { id: true },
      },
      // Última actividade
      crmActivities: {
        where:   {},
        select:  { id: true, type: true, summary: true, occurredAt: true },
        orderBy: { occurredAt: "desc" },
        take:    1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Agrupar por stage
  const grouped: Record<string, typeof companies> = {};
  for (const stage of requestedStages) {
    grouped[stage] = [];
  }
  for (const co of companies) {
    const stage = co.pipelineStage ?? "null";
    if (grouped[stage]) grouped[stage].push(co);
  }

  // Montar colunas
  const columns = requestedStages.map((stage) => {
    const items = grouped[stage] ?? [];
    const totalValue = items.reduce((sum, co) =>
      sum + co.crmDeals.reduce((s, d) => s + (d.value ?? 0), 0), 0
    );

    return {
      stage,
      count:      items.length,
      totalValue,
      companies:  items.map((co) => ({
        id:            co.id,
        name:          co.name,
        nif:           co.nif,
        crmStatus:     co.crmStatus,
        pipelineStage: co.pipelineStage,
        assignedToId:  co.assignedToId,
        sector:        co.sector,
        country:       co.country,
        createdAt:     co.createdAt,
        primaryContact: co.crmContacts[0] ?? null,
        activeDeals:   co.crmDeals,
        dealValue:     co.crmDeals.reduce((s, d) => s + (d.value ?? 0), 0),
        taskCount:     co.crmTasks.length,
        lastActivity:  co.crmActivities[0] ?? null,
      })),
    };
  });

  // Totais globais
  const totalCompanies = companies.length;
  const totalValue     = columns.reduce((s, col) => s + col.totalValue, 0);

  // KPIs WON/LOST separados (se não pedidos nas colunas)
  let wonCount = 0, lostCount = 0;
  if (!includeWon || !includeLost) {
    const [won, lost] = await Promise.all([
      includeWon ? Promise.resolve(0) : prisma.company.count({
        where: { ...companyWhere, pipelineStage: PipelineStage.WON },
      }),
      includeLost ? Promise.resolve(0) : prisma.company.count({
        where: { ...companyWhere, pipelineStage: PipelineStage.LOST },
      }),
    ]);
    wonCount  = won;
    lostCount = lost;
  }

  return NextResponse.json({
    columns,
    meta: {
      totalCompanies,
      totalValue,
      currency:  "AOA",
      wonCount,
      lostCount,
      scope:     isAdmin ? "global" : "personal",
    },
  });
}
