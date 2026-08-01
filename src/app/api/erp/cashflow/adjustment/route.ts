/**
 * POST /api/erp/cashflow/adjustment
 * Regista ajuste manual de caixa (reconciliação bancária).
 *
 * Body:
 *  {
 *    amount:      number,   — AOA, positivo (entrada) ou negativo (saída)
 *    description: string,   — ex: "Reconciliação Agosto 2026"
 *    date:        string,   — ISO date
 *    bankAccount?: string   — default: BCS-MAIN
 *  }
 *
 * Após criar o CashMovement, recalcula todos os saldos a partir da data do ajuste.
 * Se o saldo projectado nos próximos 30 dias ficar negativo, cria FinancialAlert CRITICAL.
 *
 * Requer ADMIN.
 *
 * Docs: docs/05-erp/cashflow.md#7-reconciliação-bancária
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { registerAdjustment }         from "@/lib/erp-cashflow-service";
import { isApiRateLimited }           from "@/lib/rateLimit";
import "@/lib/bootstrap";

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
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

  const { amount, description, date: dateRaw } = body;

  if (typeof amount !== "number" || amount === 0)
    return NextResponse.json({ error: "amount deve ser número não-zero (positivo ou negativo)." }, { status: 422 });
  if (!description || typeof description !== "string" || !description.trim())
    return NextResponse.json({ error: "description é obrigatória." }, { status: 422 });
  if (!dateRaw || isNaN(Date.parse(String(dateRaw))))
    return NextResponse.json({ error: "date é obrigatória e deve ser data válida." }, { status: 422 });

  try {
    const movement = await registerAdjustment(
      {
        amount,
        description: description.trim(),
        date:        new Date(String(dateRaw)),
        bankAccount: typeof body.bankAccount === "string" ? body.bankAccount : undefined,
      },
      session!.sub
    );
    return NextResponse.json(movement, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao registar ajuste.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
