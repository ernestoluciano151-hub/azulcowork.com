/**
 * GET  /api/admin/email-templates  — lista todos os templates
 * PATCH /api/admin/email-templates  — actualiza campos de um template por slug
 *
 * Permissões: ADMIN apenas
 * VOL07 — Sprint VOL07-2
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

// GET /api/admin/email-templates
export async function GET(req: NextRequest) {
  const authErr = await requireRole(req, ["ADMIN"]);
  if (authErr) return authErr;

  const templates = await prisma.emailTemplate.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id:        true,
      slug:      true,
      name:      true,
      subject:   true,
      category:  true,
      variables: true,
      isActive:  true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ templates });
}

// PATCH /api/admin/email-templates  body: { slug, name?, subject?, htmlBody?, isActive? }
export async function PATCH(req: NextRequest) {
  const authErr = await requireRole(req, ["ADMIN"]);
  if (authErr) return authErr;

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { slug, name, subject, htmlBody, isActive } = body as {
    slug:      string;
    name?:     string;
    subject?:  string;
    htmlBody?: string;
    isActive?: boolean;
  };

  if (!slug) {
    return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });
  }

  const existing = await prisma.emailTemplate.findUnique({ where: { slug } });
  if (!existing) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (name     !== undefined) data.name     = name;
  if (subject  !== undefined) data.subject  = subject;
  if (htmlBody !== undefined) data.htmlBody = htmlBody;
  if (isActive !== undefined) data.isActive = isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para actualizar" }, { status: 400 });
  }

  const updated = await prisma.emailTemplate.update({
    where: { slug },
    data,
    select: { id: true, slug: true, name: true, subject: true, isActive: true, updatedAt: true },
  });

  return NextResponse.json({ template: updated });
}
