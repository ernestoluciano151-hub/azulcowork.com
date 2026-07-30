/**
 * /api/crm/companies/:id/notes/:noteId
 *
 * PATCH  — Editar nota (ADMIN | COMERCIAL próprias)
 * DELETE — Soft-delete nota (ADMIN | COMERCIAL próprias)
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { isApiRateLimited }          from "@/lib/rateLimit";
import { prisma }                    from "@/lib/prisma";
import { sanitizeText }              from "@/lib/validators";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-notes-patch")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const { id, noteId } = await ctx.params;

  const existing = await prisma.crmNote.findFirst({
    where:  { id: noteId, companyId: id, deletedAt: null },
    select: { id: true, authorId: true, content: true },
  });
  if (!existing) return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 });

  // COMERCIAL só pode editar as suas notas
  if (session!.role === AdminRole.COMERCIAL && existing.authorId !== session!.sub) {
    return NextResponse.json({ error: "Sem permissão para editar esta nota." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const content = typeof body.content === "string" ? sanitizeText(body.content.trim()) : "";
  if (!content) return NextResponse.json({ error: "O conteúdo não pode estar vazio." }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.crmNote.update({ where: { id: noteId }, data: { content } });
      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "UPDATE",
          entityType: "CrmNote",
          entityId:   noteId,
          actorId:    session!.sub,
          ip,
          before: { contentLength: existing.content.length },
          after:  { contentLength: content.length },
        },
      });
    });
  } catch (err) {
    console.error("[PATCH /api/crm/.../notes/:noteId]", err);
    return NextResponse.json({ error: "Erro interno ao actualizar nota." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { id, noteId } = await ctx.params;

  const existing = await prisma.crmNote.findFirst({
    where:  { id: noteId, companyId: id, deletedAt: null },
    select: { id: true, authorId: true },
  });
  if (!existing) return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 });

  if (session!.role === AdminRole.COMERCIAL && existing.authorId !== session!.sub) {
    return NextResponse.json({ error: "Sem permissão para eliminar esta nota." }, { status: 403 });
  }

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.crmNote.update({ where: { id: noteId }, data: { deletedAt: now } });
      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "DELETE",
          entityType: "CrmNote",
          entityId:   noteId,
          actorId:    session!.sub,
          ip,
          after: { deletedAt: now.toISOString() },
        },
      });
    });
  } catch (err) {
    console.error("[DELETE /api/crm/.../notes/:noteId]", err);
    return NextResponse.json({ error: "Erro interno ao eliminar nota." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
