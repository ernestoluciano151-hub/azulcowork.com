/**
 * POST /api/admin/document-templates/[slug]/preview
 * body: { vars: Record<string, string> }
 *
 * Pré-visualiza o htmlBody do template com variáveis interpoladas.
 * Variáveis ausentes em vars são substituídas por [VARIAVEL] como placeholder.
 * Retorna: { subject: string, html: string, vars: string[], missing: string[] }
 *
 * Permissões: ADMIN apenas
 * VOL08 — Sprint VOL08-2A
 */

import { NextRequest, NextResponse }           from "next/server";
import { requireRole }                         from "@/lib/rbac";
import { prisma }                              from "@/lib/prisma";
import { interpolate, missingVariables }       from "@/lib/template-interpolator";

export async function POST(
  req:     NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const authErr = await requireRole(req, ["ADMIN"]);
  if (authErr) return authErr;

  const { slug } = await context.params;

  const template = await prisma.documentTemplate.findUnique({ where: { slug } });
  if (!template) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  let body: { vars?: Record<string, string> };
  try {
    body = await req.json() as { vars?: Record<string, string> };
  } catch {
    body = { vars: {} };
  }

  const vars = body.vars ?? {};

  // Substituir variáveis ausentes por placeholder legível
  const allVars = template.variables;
  const fullVars: Record<string, string> = {};
  for (const v of allVars) {
    fullVars[v] = vars[v] ?? `[${v.toUpperCase()}]`;
  }
  // Adicionar quaisquer vars extra fornecidas pelo caller
  Object.assign(fullVars, vars);

  const html    = interpolate(template.htmlBody, fullVars);
  const missing = missingVariables(template.htmlBody, vars);

  return NextResponse.json({
    slug:    template.slug,
    name:    template.name,
    type:    template.type,
    version: template.version,
    html,
    vars:    allVars,
    missing,
  });
}
