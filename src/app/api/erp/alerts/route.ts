/**
 * GET  /api/erp/alerts  — listagem de alertas financeiros
 * POST /api/erp/alerts  — cria alerta manual CUSTOM (ADMIN)
 *
 * Query params (GET):
 *   type, severity, status, companyId, page, pageSize
 *
 * RBAC:
 *   GET:  ADMIN | FINANCEIRO | COMERCIAL
 *   POST: ADMIN only
 *
 * Docs: docs/05-erp/alerts.md#6-api-de-alertas
 */

import { NextRequest, NextResponse }   from "next/server";
import { AdminRole, AlertType, AlertSeverity, AlertStatus } from "@prisma/client";
import { requireRole, requireSession } from "@/lib/auth";
import { isApiRateLimited }            from "@/lib/validators";
import { listAlerts, createCustomAlert } from "@/lib/erp-alerts-service";
import "@/lib/bootstrap";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ADMIN | FINANCEIRO | COMERCIAL
  const { error } = await requireSession(req);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const page     = parseInt(searchParams.get("page")     ?? "1",  10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

  try {
    const result = await listAlerts({
      type:      searchParams.get("type")      as AlertType      | undefined ?? undefined,
      severity:  searchParams.get("severity")  as AlertSeverity  | undefined ?? undefined,
      status:    searchParams.get("status")    as AlertStatus    | undefined ?? undefined,
      companyId: searchParams.get("companyId") ?? undefined,
      page,
      pageSize,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar alertas.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  if (await isApiRateLimited(req)) {
    return NextResponse.json({ error: "Rate limit excedido." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.title   || typeof body.title   !== "string")
    return NextResponse.json({ error: "title é obrigatório."   }, { status: 422 });
  if (!body.message || typeof body.message !== "string")
    return NextResponse.json({ error: "message é obrigatória." }, { status: 422 });

  try {
    const alert = await createCustomAlert({
      title:      body.title,
      message:    body.message,
      severity:   typeof body.severity  === "string" ? body.severity  as AlertSeverity : undefined,
      companyId:  typeof body.companyId === "string" ? body.companyId : undefined,
      dueDate:    body.dueDate && !isNaN(Date.parse(String(body.dueDate)))
        ? new Date(String(body.dueDate))
        : undefined,
      amount:     typeof body.amount === "number" ? body.amount : undefined,
    });
    return NextResponse.json(alert, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar alerta.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
