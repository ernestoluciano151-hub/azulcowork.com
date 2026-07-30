/**
 * POST /api/admin/email-templates/[slug]/preview
 *
 * Renderiza o template com variáveis de exemplo fornecidas.
 * Devolve { subject, html } prontos para pré-visualização.
 *
 * Body: { vars: Record<string, string> }
 *
 * Permissões: ADMIN apenas
 * VOL07 — Sprint VOL07-2
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { interpolateEmailTemplate } from "@/lib/template-interpolator";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const authErr = await requireRole(req, ["ADMIN"]);
  if (authErr) return authErr;

  const { slug } = params;

  const template = await prisma.emailTemplate.findUnique({ where: { slug } });
  if (!template) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  let vars: Record<string, string> = {};
  try {
    const body = await req.json() as { vars?: Record<string, string> };
    vars = body.vars ?? {};
  } catch {
    // vars vazio — todas as variáveis ficam em branco
  }

  // Preencher variáveis não fornecidas com placeholder [VARIAVEL]
  const sampleVars: Record<string, string> = {};
  for (const v of template.variables) {
    sampleVars[v] = vars[v] ?? `[${v.toUpperCase()}]`;
  }

  const { subject, html } = interpolateEmailTemplate(
    { subject: template.subject, htmlBody: template.htmlBody },
    sampleVars
  );

  return NextResponse.json({ subject, html, vars: sampleVars });
}
