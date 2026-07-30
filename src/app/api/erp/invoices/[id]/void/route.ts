/**
 * POST /api/erp/invoices/[id]/void
 *
 * Anula fatura ISSUED | SENT | OVERDUE → VOID.
 * Exige ausência de pagamentos CONFIRMED (BR-BILL-002).
 * Gera lançamentos de estorno no FinancialLedger (ADR-021).
 * Requer ADMIN.
 *
 * Body: { reason: string }
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { voidErpInvoice }             from "@/lib/erp-billing-service";
import "@/lib/bootstrap";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { id } = await params;

  let reason = "Anulação de fatura";
  try {
    const body = await req.json();
    if (typeof body.reason === "string" && body.reason.trim()) reason = body.reason.trim();
  } catch { /* sem corpo é válido */ }

  try {
    const invoice = await voidErpInvoice(id, reason, session!.sub);
    return NextResponse.json(invoice);
  } catch (err) {
    console.error("[POST /api/erp/invoices/[id]/void]", err);
    const msg = err instanceof Error ? err.message : "Erro ao anular fatura.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
