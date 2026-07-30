/**
 * /api/crm/companies/:id/deals
 *
 * GET  — Lista deals de uma empresa (todos os autenticados)
 * POST — Cria nova oportunidade (ADMIN | COMERCIAL)
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/pipeline.md
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole, CompanyStatus, DealStage } from "@prisma/client";
import { requireSession, requireRole } from "@/lib/auth";
import { isApiRateLimited }           from "@/lib/rateLimit";
import { prisma }                     from "@/lib/prisma";
import { publish }                    from "@/lib/event-bus";
import { sanitizeText }               from "@/lib/validators";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/crm/companies/:id/deals ─────────────────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await ctx.params;

  const company = await prisma.company.findFirst({
    where: { id, crmDeletedAt: null },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  const deals = await prisma.crmDeal.findMany({
    where:   { companyId: id, deletedAt: null },
    select:  {
      id: true, title: true, stage: true, value: true, currency: true,
      probability: true, expectedClose: true, lostReason: true,
      assignedToId: true, discountPct: true, approvedBy: true,
      closedAt: true, createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: deals });
}

// ── POST /api/crm/companies/:id/deals ────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-deals")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const { id } = await ctx.params;

  const company = await prisma.company.findFirst({
    where:  { id, crmDeletedAt: null },
    select: { id: true, name: true, crmStatus: true },
  });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? sanitizeText(body.title.trim()) : "";
  if (!title) return NextResponse.json({ error: "O título da oportunidade é obrigatório." }, { status: 400 });

  const value       = typeof body.value       === "number" && body.value > 0 ? body.value : undefined;
  const probability = typeof body.probability === "number" ? Math.min(100, Math.max(0, body.probability)) : undefined;
  const discountPct = typeof body.discountPct === "number" ? body.discountPct : 0;
  const approvedBy  = typeof body.approvedBy  === "string" ? body.approvedBy : undefined;

  // BR-PIPE-006: desconto > 10% requer aprovação ADMIN
  if (discountPct > 10 && !approvedBy) {
    return NextResponse.json({ error: "Desconto superior a 10% requer aprovação de ADMIN (approvedBy)." }, { status: 422 });
  }

  const expectedClose = typeof body.expectedClose === "string" ? new Date(body.expectedClose) : undefined;

  let deal: { id: string; title: string };

  try {
    deal = await prisma.$transaction(async (tx) => {
      const created = await tx.crmDeal.create({
        data: {
          companyId:    id,
          title,
          stage:        DealStage.DISCOVERY,
          value,
          currency:     typeof body.currency === "string" ? body.currency : "AOA",
          probability,
          expectedClose,
          assignedToId: typeof body.assignedToId === "string" ? body.assignedToId : session!.sub,
          discountPct,
          approvedBy,
        },
        select: { id: true, title: true },
      });

      // Se empresa ainda era PROSPECT, manter — stage de company não muda na criação do deal

      await tx.timelineEntry.create({
        data: {
          companyId:        id,
          eventType:        "DEAL_CREATED",
          title:            `Oportunidade criada: "${title}"`,
          isSystem:         false,
          actorId:          session!.sub,
          actorName:        session!.name ?? undefined,
          linkedEntityType: "CrmDeal",
          linkedEntityId:   created.id,
          metadata:         { dealId: created.id, title, value, discountPct },
        },
      });

      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "CREATE",
          entityType: "CrmDeal",
          entityId:   created.id,
          actorId:    session!.sub,
          ip,
          after: { title, stage: "DISCOVERY", value, discountPct, approvedBy },
        },
      });

      return created;
    });
  } catch (err) {
    console.error("[POST /api/crm/companies/:id/deals]", err);
    return NextResponse.json({ error: "Erro interno ao criar oportunidade." }, { status: 500 });
  }

  publish("crm.deal.created", {
    dealId:    deal.id,
    companyId: id,
    companyName: company.name,
    title:     deal.title,
    stage:     "DISCOVERY",
    value,
    currency:  typeof body.currency === "string" ? body.currency : "AOA",
    actorId:   session!.sub,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  return NextResponse.json({ ok: true, deal }, { status: 201 });
}
