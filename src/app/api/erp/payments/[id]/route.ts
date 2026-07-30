/**
 * GET /api/erp/payments/[id] — Detalhe de pagamento ERP com ledger entries.
 */

import { NextRequest, NextResponse }  from "next/server";
import { requireSession }             from "@/lib/auth";
import { getErpPayment }              from "@/lib/erp-payment-service";
import "@/lib/bootstrap";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  try {
    const payment = await getErpPayment(id);
    if (!payment) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    return NextResponse.json(payment);
  } catch (err) {
    console.error("[GET /api/erp/payments/[id]]", err);
    return NextResponse.json({ error: "Erro ao carregar pagamento." }, { status: 500 });
  }
}
