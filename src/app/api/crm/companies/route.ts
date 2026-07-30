/**
 * /api/crm/companies — Listagem e criação de empresas CRM
 *
 * GET  — Lista empresas com paginação e filtros (ADMIN | COMERCIAL | FINANCEIRO | VIEWER)
 * POST — Cria nova empresa CRM (ADMIN | COMERCIAL)
 *
 * Segurança:
 *  - requireRole() em todos os métodos
 *  - isApiRateLimited() no POST
 *  - Validação completa via crm-validators
 *  - prisma.$transaction() na escrita (via crm-service)
 *  - Audit log + Timeline em toda mutação
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole, requireSession } from "@/lib/auth";
import { isApiRateLimited }            from "@/lib/rateLimit";
import { validateCreateCompany }       from "@/lib/crm-validators";
import { createCompany, listCompanies } from "@/lib/crm-service";
import "@/lib/bootstrap";

// ── GET /api/crm/companies ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const page          = parseInt(searchParams.get("page")     ?? "1",  10);
  const pageSize      = parseInt(searchParams.get("pageSize") ?? "20", 10);
  const search        = searchParams.get("search")        ?? undefined;
  const crmStatus     = searchParams.get("crmStatus")     ?? undefined;
  const pipelineStage = searchParams.get("pipelineStage") ?? undefined;
  const assignedToId  = searchParams.get("assignedToId")  ?? undefined;

  try {
    const result = await listCompanies({ page, pageSize, search, crmStatus, pipelineStage, assignedToId });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/crm/companies]", err);
    return NextResponse.json({ error: "Erro interno ao listar empresas." }, { status: 500 });
  }
}

// ── POST /api/crm/companies ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth: ADMIN ou COMERCIAL
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  // 2. Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-companies")) {
    return NextResponse.json({ error: "Demasiadas tentativas. Aguarde um momento." }, { status: 429 });
  }

  // 3. Parse e validação
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const validation = validateCreateCompany(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  // 4. Criar empresa (transacção + audit + timeline + evento)
  const result = await createCompany(
    validation.data,
    session!.sub,
    session!.name ?? null,
    ip
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { ok: true, company: result.data },
    { status: 201 }
  );
}
