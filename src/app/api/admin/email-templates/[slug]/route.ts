/**
 * GET /api/admin/email-templates/[slug]  — detalhe completo de um template
 *
 * Permissões: ADMIN apenas
 * VOL07 — Sprint VOL07-2
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const authErr = await requireRole(req, ["ADMIN"]);
  if (authErr) return authErr;

  const { slug } = params;

  const template = await prisma.emailTemplate.findUnique({
    where: { slug },
  });

  if (!template) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ template });
}
