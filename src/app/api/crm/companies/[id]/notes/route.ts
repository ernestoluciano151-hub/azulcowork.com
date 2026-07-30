/**
 * /api/crm/companies/:id/notes
 *
 * GET  — Lista notas de uma empresa (ADMIN | COMERCIAL | FINANCEIRO | VIEWER)
 * POST — Cria nota interna (ADMIN | COMERCIAL)
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireSession, requireRole } from "@/lib/auth";
import { isApiRateLimited }           from "@/lib/rateLimit";
import { prisma }                     from "@/lib/prisma";
import { sanitizeText }               from "@/lib/validators";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await ctx.params;

  const company = await prisma.company.findFirst({
    where: { id, crmDeletedAt: null }, select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  const notes = await prisma.crmNote.findMany({
    where:   { companyId: id, deletedAt: null },
    select:  { id: true, content: true, authorId: true, dealId: true, contactId: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: notes });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-notes")) {
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

  const content = typeof body.content === "string" ? sanitizeText(body.content.trim()) : "";
  if (content.length < 1) {
    return NextResponse.json({ error: "O conteúdo da nota não pode estar vazio." }, { status: 400 });
  }

  let note: { id: string };

  try {
    note = await prisma.$transaction(async (tx) => {
      const created = await tx.crmNote.create({
        data: {
          companyId: id,
          content,
          authorId:  session!.sub,
          dealId:    typeof body.dealId    === "string" ? body.dealId    : undefined,
          contactId: typeof body.contactId === "string" ? body.contactId : undefined,
        },
        select: { id: true },
      });

      await tx.timelineEntry.create({
        data: {
          companyId:        id,
          eventType:        "NOTE_ADDED",
          title:            "Nota adicionada",
          description:      content.slice(0, 120) + (content.length > 120 ? "…" : ""),
          isSystem:         false,
          actorId:          session!.sub,
          actorName:        session!.name ?? undefined,
          linkedEntityType: "CrmNote",
          linkedEntityId:   created.id,
          metadata:         { noteId: created.id },
        },
      });

      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "CREATE",
          entityType: "CrmNote",
          entityId:   created.id,
          actorId:    session!.sub,
          ip,
          after: { contentLength: content.length, dealId: body.dealId ?? null },
        },
      });

      return created;
    });
  } catch (err) {
    console.error("[POST /api/crm/.../notes]", err);
    return NextResponse.json({ error: "Erro interno ao criar nota." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, note }, { status: 201 });
}
