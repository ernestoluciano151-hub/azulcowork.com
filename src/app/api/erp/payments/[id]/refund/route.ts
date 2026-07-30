/**
 * POST /api/erp/payments/[id]/refund
 * Reembolsa pagamento CONFIRMED → REFUNDED.
 * Gera estorno no FinancialLedger + CashMovement OUTFLOW + reverte Invoice.
 * Requer ADMIN.
 * Body: { reason?: string }
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { refundErpPayment }           from "@/lib/erp-payment-service";
import "@/lib/bootstrap";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { id } = await params;

  let reason = "Reembolso de pagamento";
  try {
    const body = await req.json();
    if (typeof body.reason === "string" && body.reason.trim()) reason = body.reason.trim();
  } catch { /* sem corpo é válido */ }

  try {
    const payment = await refundErpPayment(id, reason, session!.sub);
    return NextResponse.json(payment);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao reembolsar pagamento.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
