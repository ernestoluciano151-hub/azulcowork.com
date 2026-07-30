/**
 * POST /api/erp/invoices/[id]/issue
 *
 * Emite fatura: DRAFT → ISSUED.
 * Gera número atómico (FT-CWORK / FT-SALA / FT-SERV) e lançamentos contabilísticos.
 * Requer ADMIN | FINANCEIRO.
 *
 * Docs: docs/05-erp/billing.md · docs/adr/README.md#adr-021
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { issueErpInvoice }            from "@/lib/erp-billing-service";
import "@/lib/bootstrap";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { id } = await params;

  try {
    const invoice = await issueErpInvoice(id, session!.sub);
    return NextResponse.json(invoice);
  } catch (err) {
    console.error("[POST /api/erp/invoices/[id]/issue]", err);
    const msg = err instanceof Error ? err.message : "Erro ao emitir fatura.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
