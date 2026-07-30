/**
 * GET /api/crm/companies/duplicates
 *
 * Lista pares de empresas CRM com similaridade de nome ≥ 85%.
 * Usado para revisão manual e fusão de duplicados.
 *
 * Query params:
 *   threshold  — score mínimo (0.0–1.0); default: 0.85
 *   limit      — máximo de pares devolvidos; default: 50, max: 200
 *
 * Só ADMIN pode aceder (informação sensível de toda a base de clientes).
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole }                 from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { similarityScore }           from "@/lib/crm-validators";
import "@/lib/bootstrap";

const DEFAULT_THRESHOLD = 0.85;
const DEFAULT_LIMIT     = 50;
const MAX_LIMIT         = 200;
const MAX_CANDIDATES    = 1000; // limitar memória

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { searchParams } = req.nextUrl;

  const threshold = Math.min(
    1,
    Math.max(0, parseFloat(searchParams.get("threshold") ?? String(DEFAULT_THRESHOLD)))
  );
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10))
  );

  // Carregar todas as empresas CRM activas (sem soft-delete, sem MERGED)
  const companies = await prisma.company.findMany({
    where: {
      crmDeletedAt:  null,
      crmStatus:     { not: "MERGED" },
      pipelineStage: { not: null }, // só empresas que entraram no funil CRM
    },
    select: { id: true, name: true, nif: true, pipelineStage: true, crmStatus: true },
    take: MAX_CANDIDATES,
    orderBy: { createdAt: "asc" },
  });

  // Comparação O(n²) com early exit por threshold
  // Para 1000 empresas = ~500k comparações — aceitável para execução síncrona
  const pairs: Array<{
    companyA: { id: string; name: string; nif: string | null };
    companyB: { id: string; name: string; nif: string | null };
    score: number;
  }> = [];

  for (let i = 0; i < companies.length && pairs.length < limit; i++) {
    for (let j = i + 1; j < companies.length && pairs.length < limit; j++) {
      const score = similarityScore(companies[i].name, companies[j].name);
      if (score >= threshold) {
        pairs.push({
          companyA: { id: companies[i].id, name: companies[i].name, nif: companies[i].nif ?? null },
          companyB: { id: companies[j].id, name: companies[j].name, nif: companies[j].nif ?? null },
          score:    Math.round(score * 100) / 100,
        });
      }
    }
  }

  // Ordenar por score descendente
  pairs.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    data: pairs,
    meta: {
      total:             pairs.length,
      threshold,
      candidatesScanned: companies.length,
      limitApplied:      pairs.length >= limit,
    },
  });
}
