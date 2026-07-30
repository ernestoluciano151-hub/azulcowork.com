/**
 * GET   /api/erp/alerts/[id]  — detalhe do alerta
 * PATCH /api/erp/alerts/[id]  — acknowledge | resolve | snooze
 *
 * Body PATCH:
 *  { action: "acknowledge" | "resolve" | "snooze", days?: number }
 *
 * Requer ADMIN | FINANCEIRO.
 */

import { NextRequest, NextResponse }   from "next/server";
import { AdminRole }                   from "@prisma/client";
import { requireRole, requireSession } from "@/lib/auth";
import {
  getAlert,
  acknowledgeAlert,
  resolveAlert,
  snoozeAlert,
}                                      from "@/lib/erp-alerts-service";
import "@/lib/bootstrap";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession(req);
  if (error) return error;

  const { id } = await params;

  try {
    const alert = await getAlert(id);
    return NextResponse.json(alert);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao obter alerta.";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const action = body.action;
  if (!action || typeof action !== "string")
    return NextResponse.json(
      { error: "action é obrigatória: 'acknowledge' | 'resolve' | 'snooze'." },
      { status: 422 }
    );

  try {
    let result;
    switch (action) {
      case "acknowledge":
        result = await acknowledgeAlert(id, session!.sub);
        break;
      case "resolve":
        result = await resolveAlert(id, session!.sub);
        break;
      case "snooze": {
        const days = typeof body.days === "number" ? body.days : 7;
        result = await snoozeAlert(id, days, session!.sub);
        break;
      }
      default:
        return NextResponse.json(
          { error: `Acção desconhecida: '${action}'. Use 'acknowledge', 'resolve' ou 'snooze'.` },
          { status: 422 }
        );
    }
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao actualizar alerta.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
