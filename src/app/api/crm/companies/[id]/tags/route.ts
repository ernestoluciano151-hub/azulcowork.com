/**
 * /api/crm/companies/:id/tags
 *
 * GET  — Lista tags associadas a uma empresa (todos os roles autenticados)
 * POST — Associa uma tag a uma empresa (ADMIN | COMERCIAL)
 *        Body: { tagId: string }
 *        Máximo de 20 tags por empresa (BR-TAG-001)
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse }   from "next/server";
import { AdminRole }                   from "@prisma/client";
import { requireSession, requireRole } from "@/lib/auth";
import { isApiRateLimited }            from "@/lib/rateLimit";
import { prisma }                      from "@/lib/prisma";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_TAGS_PER_COMPANY = 20;

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await ctx.params;

  const company = await prisma.company.findFirst({
    where: { id, crmDeletedAt: null }, select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  const companyTags = await prisma.companyTag.findMany({
    where:   { companyId: id },
    include: { tag: { select: { id: true, name: true, color: true } } },
    orderBy: { assignedAt: "asc" },
  });

  const data = companyTags.map((ct) => ({
    tagId:      ct.tagId,
    name:       ct.tag.name,
    color:      ct.tag.color,
    assignedAt: ct.assignedAt,
    assignedBy: ct.assignedBy,
  }));

  return NextResponse.json({ data });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-company-tags")) {
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

  const tagId = typeof body.tagId === "string" ? body.tagId.trim() : "";
  if (!tagId) return NextResponse.json({ error: "tagId é obrigatório." }, { status: 400 });

  // Verificar que a tag existe
  const tag = await prisma.tag.findUnique({ where: { id: tagId }, select: { id: true, name: true } });
  if (!tag) return NextResponse.json({ error: "Tag não encontrada." }, { status: 404 });

  // Verificar se já está associada
  const already = await prisma.companyTag.findUnique({
    where: { companyId_tagId: { companyId: id, tagId } },
    select: { tagId: true },
  });
  if (already) return NextResponse.json({ error: "Esta tag já está associada à empresa." }, { status: 409 });

  // BR-TAG-001: máximo de 20 tags por empresa
  const currentCount = await prisma.companyTag.count({ where: { companyId: id } });
  if (currentCount >= MAX_TAGS_PER_COMPANY) {
    return NextResponse.json({
      error: `Máximo de ${MAX_TAGS_PER_COMPANY} tags por empresa atingido.`,
    }, { status: 422 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.companyTag.create({
        data: { companyId: id, tagId, assignedBy: session!.sub },
      });
      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "CREATE",
          entityType: "CompanyTag",
          entityId:   tagId,
          actorId:    session!.sub,
          ip,
          after: { tagId, tagName: tag.name },
        },
      });
    });
  } catch (err) {
    console.error("[POST /api/crm/companies/:id/tags]", err);
    return NextResponse.json({ error: "Erro interno ao associar tag." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
