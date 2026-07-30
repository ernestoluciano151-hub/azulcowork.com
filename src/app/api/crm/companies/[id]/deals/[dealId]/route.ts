/**
 * /api/crm/companies/:id/deals/:dealId
 *
 * GET    — Detalhes de uma oportunidade (todos os autenticados)
 * PATCH  — Actualizar oportunidade / avançar stage (ADMIN | COMERCIAL)
 * DELETE — Soft-delete (ADMIN | COMERCIAL próprios)
 *
 * Transições de stage — regras de negócio:
 *  BR-PIPE-001: Só transições da state machine são aceites
 *  BR-PIPE-005: Máx. 1 deal em NEGOTIATION por empresa
 *  BR-PIPE-006: discountPct > 10% → approvedBy obrigatório
 *  BR-PIPE-007: → LOST → lostReason obrigatório
 *  BR-PIPE-008: → WON → company.crmStatus = ACTIVE
 *
 * Docs: docs/04-crm/pipeline.md · docs/04-crm/api.md
 */

import { NextRequest, NextResponse }        from "next/server";
import { AdminRole, CompanyStatus, DealStage } from "@prisma/client";
import { requireSession, requireRole }      from "@/lib/auth";
import { isApiRateLimited }                from "@/lib/rateLimit";
import { prisma }                          from "@/lib/prisma";
import { publish }                         from "@/lib/event-bus";
import { sanitizeText }                    from "@/lib/validators";
import {
  validateTransition,
  isWinningTransition,
  isLosingTransition,
  calcCycleTimeDays,
  getAllowedTransitions,
} from "@/lib/pipeline-state-machine";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string; dealId: string }> };

// ── GET /api/crm/companies/:id/deals/:dealId ──────────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id, dealId } = await ctx.params;

  const deal = await prisma.crmDeal.findFirst({
    where:  { id: dealId, companyId: id, deletedAt: null },
    select: {
      id: true, title: true, stage: true, value: true, currency: true,
      probability: true, expectedClose: true, lostReason: true,
      assignedToId: true, discountPct: true, approvedBy: true,
      closedAt: true, createdAt: true, updatedAt: true,
    },
  });

  if (!deal) return NextResponse.json({ error: "Oportunidade não encontrada." }, { status: 404 });

  return NextResponse.json({
    data: {
      ...deal,
      allowedTransitions: getAllowedTransitions(deal.stage),
    },
  });
}

// ── PATCH /api/crm/companies/:id/deals/:dealId ────────────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-deals-patch")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const { id, dealId } = await ctx.params;

  const existing = await prisma.crmDeal.findFirst({
    where:  { id: dealId, companyId: id, deletedAt: null },
    select: { id: true, title: true, stage: true, value: true, currency: true, assignedToId: true, discountPct: true, createdAt: true },
  });
  if (!existing) return NextResponse.json({ error: "Oportunidade não encontrada." }, { status: 404 });

  // COMERCIAL só pode editar deals atribuídos a si
  if (session!.role === AdminRole.COMERCIAL && existing.assignedToId !== session!.sub) {
    return NextResponse.json({ error: "Sem permissão para editar esta oportunidade." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const tracked: Record<string, unknown> = {};

  // Campos editáveis directos
  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = sanitizeText(body.title.trim()); tracked.title = updates.title;
  }
  if (typeof body.value === "number" && body.value >= 0) {
    updates.value = body.value; tracked.value = body.value;
  }
  if (typeof body.probability === "number") {
    updates.probability = Math.min(100, Math.max(0, body.probability));
    tracked.probability = updates.probability;
  }
  if (typeof body.expectedClose === "string") {
    updates.expectedClose = new Date(body.expectedClose); tracked.expectedClose = body.expectedClose;
  }
  if (typeof body.assignedToId === "string" && session!.role === AdminRole.ADMIN) {
    updates.assignedToId = body.assignedToId; tracked.assignedToId = body.assignedToId;
  }

  // Transição de stage
  const newStage = typeof body.stage === "string" ? body.stage as DealStage : null;
  let stageChanged = false;

  if (newStage && newStage !== existing.stage) {
    // Contar deals em NEGOTIATION nesta empresa (excluindo este)
    const negotiationCount = newStage === DealStage.NEGOTIATION
      ? await prisma.crmDeal.count({
          where: { companyId: id, stage: DealStage.NEGOTIATION, deletedAt: null, id: { not: dealId } },
        })
      : 0;

    const discountPct = typeof body.discountPct === "number" ? body.discountPct : (existing.discountPct ?? 0);
    const approvedBy  = typeof body.approvedBy  === "string" ? body.approvedBy : undefined;

    const validation = validateTransition({
      companyId: id,
      dealId,
      currentStage:     existing.stage,
      targetStage:      newStage,
      lostReason:       typeof body.lostReason === "string" ? body.lostReason.trim() : undefined,
      discountPct,
      approvedBy,
      actorRole:        session!.role ?? "",
      negotiationCount,
    });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    updates.stage       = newStage;
    tracked.stage       = newStage;
    stageChanged        = true;

    if (newStage === DealStage.LOST) {
      updates.lostReason = (body.lostReason as string).trim();
      updates.closedAt   = new Date();
      tracked.lostReason = updates.lostReason;
    }
    if (newStage === DealStage.WON) {
      updates.closedAt = new Date();
    }
    if (typeof body.discountPct === "number") {
      updates.discountPct = body.discountPct;
      if (body.approvedBy) updates.approvedBy = body.approvedBy;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para actualizar." }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where:  { id },
    select: { id: true, name: true, crmStatus: true },
  });

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.crmDeal.update({ where: { id: dealId }, data: updates });

      // BR-PIPE-008: WON → company.crmStatus = ACTIVE
      if (stageChanged && newStage === DealStage.WON && company?.crmStatus !== CompanyStatus.ACTIVE) {
        await tx.company.update({
          where: { id },
          data:  { crmStatus: CompanyStatus.ACTIVE, pipelineStage: "WON" },
        });
      }

      // Timeline entry para transição de stage
      if (stageChanged) {
        const title = newStage === DealStage.WON
          ? `Oportunidade ganha: "${existing.title}"${existing.value ? ` — ${existing.currency} ${existing.value.toLocaleString()}` : ""}`
          : newStage === DealStage.LOST
          ? `Oportunidade perdida: "${existing.title}" — ${body.lostReason}`
          : `Oportunidade "${existing.title}": ${existing.stage} → ${newStage}`;

        await tx.timelineEntry.create({
          data: {
            companyId:        id,
            eventType:        newStage === DealStage.WON ? "DEAL_WON" : newStage === DealStage.LOST ? "DEAL_LOST" : "DEAL_STAGE_CHANGED",
            title,
            isSystem:         false,
            actorId:          session!.sub,
            actorName:        session!.name ?? undefined,
            occurredAt:       now,
            linkedEntityType: "CrmDeal",
            linkedEntityId:   dealId,
            metadata:         {
              dealId,
              previousStage: existing.stage,
              newStage,
              value: existing.value,
              lostReason: body.lostReason ?? null,
            },
          },
        });
      }

      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     stageChanged ? `STAGE_CHANGE_${existing.stage}_TO_${newStage}` : "UPDATE",
          entityType: "CrmDeal",
          entityId:   dealId,
          actorId:    session!.sub,
          ip,
          before: { stage: existing.stage, value: existing.value },
          after:  tracked,
        },
      });
    });
  } catch (err) {
    console.error("[PATCH /api/crm/companies/:id/deals/:dealId]", err);
    return NextResponse.json({ error: "Erro interno ao actualizar oportunidade." }, { status: 500 });
  }

  // Eventos de domínio (após persistência)
  const ts = now.toISOString();
  if (stageChanged) {
    if (isWinningTransition(existing.stage, newStage!)) {
      publish("crm.deal.won", {
        dealId, companyId: id, companyName: company?.name ?? "",
        title: existing.title, value: existing.value ?? undefined,
        currency: existing.currency, closedBy: session!.sub,
        cycleTimeDays: calcCycleTimeDays(existing.createdAt, now),
        timestamp: ts,
      }).catch(() => {});
    } else if (isLosingTransition(existing.stage, newStage!)) {
      publish("crm.deal.lost", {
        dealId, companyId: id, companyName: company?.name ?? "",
        title: existing.title, lostReason: (body.lostReason as string) ?? "",
        value: existing.value ?? undefined, actorId: session!.sub, timestamp: ts,
      }).catch(() => {});
    } else {
      publish("crm.deal.stageChanged", {
        dealId, companyId: id, title: existing.title,
        previousStage: existing.stage, newStage: newStage!,
        actorId: session!.sub, timestamp: ts,
      }).catch(() => {});
    }
  } else {
    publish("crm.deal.created", {
      // Reutilizar crm.deal.created como update event (não há crm.deal.updated)
      // Publicar crm.company.updated para registar a alteração
      dealId, companyId: id, companyName: company?.name ?? "",
      title: (updates.title as string) ?? existing.title,
      stage: existing.stage, value: existing.value ?? undefined,
      currency: existing.currency, actorId: session!.sub, timestamp: ts,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/crm/companies/:id/deals/:dealId — Soft-delete ────────────────

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { id, dealId } = await ctx.params;

  const existing = await prisma.crmDeal.findFirst({
    where:  { id: dealId, companyId: id, deletedAt: null },
    select: { id: true, title: true, stage: true, assignedToId: true },
  });
  if (!existing) return NextResponse.json({ error: "Oportunidade não encontrada." }, { status: 404 });

  // COMERCIAL só pode eliminar os seus próprios deals
  if (session!.role === AdminRole.COMERCIAL && existing.assignedToId !== session!.sub) {
    return NextResponse.json({ error: "Sem permissão para eliminar esta oportunidade." }, { status: 403 });
  }

  // Não eliminar deals em WON (registo histórico importante)
  if (existing.stage === DealStage.WON) {
    return NextResponse.json({ error: "Não é possível eliminar uma oportunidade ganha. Marque-a como LOST se necessário." }, { status: 422 });
  }

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.crmDeal.update({ where: { id: dealId }, data: { deletedAt: now } });

      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "DELETE",
          entityType: "CrmDeal",
          entityId:   dealId,
          actorId:    session!.sub,
          ip,
          before: { title: existing.title, stage: existing.stage },
          after:  { deletedAt: now.toISOString() },
        },
      });
    });
  } catch (err) {
    console.error("[DELETE /api/crm/companies/:id/deals/:dealId]", err);
    return NextResponse.json({ error: "Erro interno ao eliminar oportunidade." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
