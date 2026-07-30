/**
 * POST /api/crm/companies/check-duplicate
 *
 * Verifica se uma empresa com o mesmo nome ou NIF já existe.
 * Usado antes de criar uma nova empresa para alertar o utilizador.
 *
 * Body: { name: string; nif?: string; excludeId?: string }
 *
 * Resposta:
 *  - exactNif: empresa com NIF idêntico (se NIF fornecido)
 *  - similar:  array de empresas com similaridade ≥ 85% no nome, ordenadas por score
 *
 * Não cria nem modifica dados — só lê.
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse }   from "next/server";
import { AdminRole }                   from "@prisma/client";
import { requireRole }                 from "@/lib/auth";
import { isApiRateLimited }            from "@/lib/rateLimit";
import { prisma }                      from "@/lib/prisma";
import { similarityScore }             from "@/lib/crm-validators";
import "@/lib/bootstrap";

const SIMILARITY_THRESHOLD = 0.85;

export async function POST(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-check-duplicate")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const name      = typeof body.name === "string" ? body.name.trim() : "";
  const nif       = typeof body.nif  === "string" ? body.nif.replace(/\s/g, "") : undefined;
  const excludeId = typeof body.excludeId === "string" ? body.excludeId : undefined;

  if (name.length < 2) {
    return NextResponse.json({ error: "O nome deve ter pelo menos 2 caracteres." }, { status: 400 });
  }

  // 1. Verificar NIF exacto
  let exactNif: { id: string; name: string; nif: string | null } | null = null;
  if (nif && /^\d{10}$/.test(nif)) {
    exactNif = await prisma.company.findFirst({
      where: {
        nif,
        crmDeletedAt: null,
        crmStatus:    { not: "MERGED" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true, nif: true },
    });
  }

  // 2. Buscar candidatos a nome similar — carregar apenas empresas CRM activas
  //    Limitado a 500 empresas activas para manter o cálculo em memória eficiente
  const candidates = await prisma.company.findMany({
    where: {
      crmDeletedAt: null,
      crmStatus:    { not: "MERGED" },
      pipelineStage: { not: null }, // só empresas CRM
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true, nif: true, pipelineStage: true },
    take: 500,
  });

  const similar = candidates
    .map((c) => ({ ...c, score: similarityScore(name, c.name) }))
    .filter((c) => c.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10) // devolver no máximo 10 sugestões
    .map(({ id, name: n, nif: candidateNif, pipelineStage, score }) => ({
      id,
      name: n,
      nif:  candidateNif,
      pipelineStage,
      score: Math.round(score * 100) / 100,
    }));

  return NextResponse.json({
    hasDuplicate: !!exactNif || similar.length > 0,
    exactNif:     exactNif ?? null,
    similar,
  });
}
