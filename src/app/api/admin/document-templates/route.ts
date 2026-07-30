/**
 * GET  /api/admin/document-templates — lista todos os templates (sem htmlBody)
 * PATCH /api/admin/document-templates — actualiza campos; incrementa version atomicamente
 *
 * Permissões: ADMIN apenas
 * VOL08 — Sprint VOL08-2A
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole }               from "@/lib/rbac";
import { prisma }                    from "@/lib/prisma";

// GET /api/admin/document-templates
export async function GET(req: NextRequest) {
  const authErr = await requireRole(req, ["ADMIN"]);
  if (authErr) return authErr;

  const templates = await prisma.documentTemplate.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id:          true,
      slug:        true,
      name:        true,
      type:        true,
      description: true,
      variables:   true,
      version:     true,
      isActive:    true,
      updatedAt:   true,
    },
  });

  return NextResponse.json({ templates });
}

// PATCH /api/admin/document-templates
// body: { slug, name?, description?, htmlBody?, isActive? }
// Se htmlBody for alterado → version é incrementado atomicamente
export async function PATCH(req: NextRequest) {
  const authErr = await requireRole(req, ["ADMIN"]);
  if (authErr) return authErr;

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { slug, name, description, htmlBody, isActive } = body as {
    slug:         string;
    name?:        string;
    description?: string;
    htmlBody?:    string;
    isActive?:    boolean;
  };

  if (!slug) {
    return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });
  }

  const existing = await prisma.documentTemplate.findUnique({ where: { slug } });
  if (!existing) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  // Se htmlBody foi alterado → incrementar version atomicamente (condição PO)
  const htmlBodyChanged = htmlBody !== undefined && htmlBody !== existing.htmlBody;

  const updated = await prisma.documentTemplate.update({
    where: { slug },
    data: {
      ...(name        !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(htmlBody    !== undefined && { htmlBody }),
      ...(isActive    !== undefined && { isActive }),
      ...(htmlBodyChanged && { version: { increment: 1 } }),
    },
    select: {
      id:          true,
      slug:        true,
      name:        true,
      type:        true,
      description: true,
      variables:   true,
      version:     true,
      isActive:    true,
      updatedAt:   true,
    },
  });

  return NextResponse.json({ template: updated, versionBumped: htmlBodyChanged });
}
