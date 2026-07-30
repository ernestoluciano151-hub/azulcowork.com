/**
 * POST /api/erp/payments/[id]/confirm
 *
 * Confirma pagamento PENDING → CONFIRMED.
 * Gera: FinancialLedger (partida dupla) + CashMovement INFLOW + REC + Timeline.
 * Actualiza Invoice (PAID | PARTIALLY_PAID). Resolve alerta PAYMENT_OVERDUE.
 * Requer ADMIN | FINANCEIRO (BR-PAY-001).
 *
 * Docs: docs/05-erp/payments.md#3-ciclo-de-vida-do-pagamento
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { confirmErpPayment }          from "@/lib/erp-payment-service";
import "@/lib/bootstrap";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { id } = await params;

  try {
    const payment = await confirmErpPayment(id, session!.sub);
    return NextResponse.json(payment);
  } catch (err) {
    console.error("[POST /api/erp/payments/[id]/confirm]", err);
    const msg = err instanceof Error ? err.message : "Erro ao confirmar pagamento.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
