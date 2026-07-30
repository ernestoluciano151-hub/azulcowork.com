/**
 * GET /api/admin/document-templates/[slug] — detalhe completo incluindo htmlBody
 *
 * Permissões: ADMIN apenas
 * VOL08 — Sprint VOL08-2A
 */

import { NextRequest, NextResponse }        from "next/server";
import { requireRole }                      from "@/lib/rbac";
import { prisma }                           from "@/lib/prisma";

export async function GET(
  req:     NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const authErr = await requireRole(req, ["ADMIN"]);
  if (authErr) return authErr;

  const { slug } = await context.params;

  const template = await prisma.documentTemplate.findUnique({
    where: { slug },
  });

  if (!template) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ template });
}
