/**
 * /api/crm/tags/:tagId
 *
 * PATCH  — Editar tag (ADMIN apenas)
 * DELETE — Eliminar tag global (ADMIN apenas; bloqueia se ainda tiver empresas associadas)
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole }                 from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { isApiRateLimited }          from "@/lib/rateLimit";
import { prisma }                    from "@/lib/prisma";
import { sanitizeText }              from "@/lib/validators";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ tagId: string }> };

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-tags-patch")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const { tagId } = await ctx.params;

  const existing = await prisma.tag.findUnique({
    where:  { id: tagId },
    select: { id: true, name: true, color: true },
  });
  if (!existing) return NextResponse.json({ error: "Tag não encontrada." }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const tracked: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = sanitizeText(body.name.trim());
    if (name.length < 2) return NextResponse.json({ error: "O nome deve ter pelo menos 2 caracteres." }, { status: 400 });
    if (name.length > 50) return NextResponse.json({ error: "O nome não pode exceder 50 caracteres." }, { status: 400 });

    const conflict = await prisma.tag.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, id: { not: tagId } },
      select: { id: true },
    });
    if (conflict) return NextResponse.json({ error: "Já existe uma tag com este nome." }, { status: 409 });

    updates.name = name;
    tracked.name = name;
  }

  if (typeof body.color === "string") {
    if (body.color === "") {
      updates.color = null;
      tracked.color = null;
    } else if (/^#[0-9A-Fa-f]{6}$/.test(body.color.trim())) {
      updates.color = body.color.trim();
      tracked.color = body.color.trim();
    } else {
      return NextResponse.json({ error: "Cor inválida. Use formato hexadecimal (#RRGGBB)." }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para actualizar." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tag.update({ where: { id: tagId }, data: updates });
      await tx.crmAuditLog.create({
        data: {
          companyId:  null,
          action:     "UPDATE",
          entityType: "Tag",
          entityId:   tagId,
          actorId:    session!.sub,
          ip,
          before: { name: existing.name, color: existing.color },
          after:  tracked,
        },
      });
    });
  } catch (err) {
    console.error("[PATCH /api/crm/tags/:tagId]", err);
    return NextResponse.json({ error: "Erro interno ao actualizar tag." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { tagId } = await ctx.params;

  const existing = await prisma.tag.findUnique({
    where:  { id: tagId },
    select: { id: true, name: true, _count: { select: { companyTags: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Tag não encontrada." }, { status: 404 });

  // Bloquear eliminação se ainda tiver empresas associadas
  if (existing._count.companyTags > 0) {
    return NextResponse.json({
      error: `Não é possível eliminar uma tag em uso. Está associada a ${existing._count.companyTags} empresa(s). Remova primeiro a associação.`,
    }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tag.delete({ where: { id: tagId } });
      await tx.crmAuditLog.create({
        data: {
          companyId:  null,
          action:     "DELETE",
          entityType: "Tag",
          entityId:   tagId,
          actorId:    session!.sub,
          ip,
          before: { name: existing.name },
        },
      });
    });
  } catch (err) {
    console.error("[DELETE /api/crm/tags/:tagId]", err);
    return NextResponse.json({ error: "Erro interno ao eliminar tag." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
