/**
 * /api/crm/tags
 *
 * GET  — Lista todas as tags globais (todos os roles autenticados)
 * POST — Cria nova tag global (ADMIN apenas)
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole }                 from "@prisma/client";
import { requireSession, requireRole } from "@/lib/auth";
import { isApiRateLimited }          from "@/lib/rateLimit";
import { prisma }                    from "@/lib/prisma";
import { sanitizeText }              from "@/lib/validators";
import "@/lib/bootstrap";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      id:        true,
      name:      true,
      color:     true,
      createdAt: true,
      _count:    { select: { companyTags: true } },
    },
  });

  const data = tags.map((t) => ({
    id:           t.id,
    name:         t.name,
    color:        t.color,
    createdAt:    t.createdAt,
    companyCount: t._count.companyTags,
  }));

  return NextResponse.json({ data, meta: { total: data.length } });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-tags-post")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? sanitizeText(body.name.trim()) : "";
  if (name.length < 2) {
    return NextResponse.json({ error: "O nome da tag deve ter pelo menos 2 caracteres." }, { status: 400 });
  }
  if (name.length > 50) {
    return NextResponse.json({ error: "O nome da tag não pode exceder 50 caracteres." }, { status: 400 });
  }

  const color = typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color.trim())
    ? body.color.trim()
    : null;

  // Verificar unicidade (case-insensitive)
  const existing = await prisma.tag.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Já existe uma tag com este nome." }, { status: 409 });
  }

  let tag: { id: string; name: string; color: string | null };
  try {
    tag = await prisma.$transaction(async (tx) => {
      const created = await tx.tag.create({
        data: { name, color },
        select: { id: true, name: true, color: true },
      });
      await tx.crmAuditLog.create({
        data: {
          companyId:  null, // operação global, sem empresa associada
          action:     "CREATE",
          entityType: "Tag",
          entityId:   created.id,
          actorId:    session!.sub,
          ip,
          after: { name, color },
        },
      });
      return created;
    });
  } catch (err) {
    console.error("[POST /api/crm/tags]", err);
    return NextResponse.json({ error: "Erro interno ao criar tag." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tag }, { status: 201 });
}
