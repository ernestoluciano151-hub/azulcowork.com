/**
 * GET /api/erp/cashflow
 * Listagem de movimentos de caixa reais (+ projectados opcionalmente).
 *
 * Query params:
 *   from             — data início ISO (opcional)
 *   to               — data fim ISO (opcional)
 *   includeProjected — "true" para incluir movimentos projectados (default: false)
 *   groupBy          — "day" | "week" | "month" (opcional — sem valor = lista raw)
 *   bankAccount      — conta bancária (default: BCS-MAIN)
 *
 * Resposta:
 *  { movements: [...], groups: [...] | null }
 *
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/cashflow.md
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import {
  getCashflowMovements,
  type GroupBy,
}                                     from "@/lib/erp-cashflow-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = req.nextUrl;

  let from: Date | undefined;
  let to:   Date | undefined;

  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");

  if (fromParam) {
    const d = new Date(fromParam);
    if (isNaN(d.getTime()))
      return NextResponse.json({ error: "Parâmetro 'from' inválido." }, { status: 422 });
    from = d;
  }
  if (toParam) {
    const d = new Date(toParam);
    if (isNaN(d.getTime()))
      return NextResponse.json({ error: "Parâmetro 'to' inválido." }, { status: 422 });
    to = d;
  }

  const groupByParam = searchParams.get("groupBy");
  const validGroupBy = ["day", "week", "month"];
  const groupBy: GroupBy | undefined = validGroupBy.includes(groupByParam ?? "")
    ? (groupByParam as GroupBy)
    : undefined;

  try {
    const result = await getCashflowMovements({
      bankAccount:      searchParams.get("bankAccount") ?? undefined,
      includeProjected: searchParams.get("includeProjected") === "true",
      from,
      to,
      groupBy,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao obter movimentos de caixa.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
