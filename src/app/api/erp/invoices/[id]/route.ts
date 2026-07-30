/**
 * GET /api/erp/invoices/[id] — Detalhe completo de fatura ERP
 * Inclui items, pagamentos e lançamentos no ledger.
 */

import { NextRequest, NextResponse }  from "next/server";
import { requireSession }             from "@/lib/auth";
import { getErpInvoice }              from "@/lib/erp-billing-service";
import "@/lib/bootstrap";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  try {
    const invoice = await getErpInvoice(id);
    if (!invoice) return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (err) {
    console.error("[GET /api/erp/invoices/[id]]", err);
    return NextResponse.json({ error: "Erro ao carregar fatura." }, { status: 500 });
  }
}
