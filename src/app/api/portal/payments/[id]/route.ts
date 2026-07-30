/**
 * GET /api/portal/payments/[id]
 *
 * Detalhe de pagamento ERP (valor, método, data, referência, fatura associada).
 * Não expõe receiptUrl directamente — usar /receipt para URL assinada.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { id } = await params;

    const payment = await prisma.erpPayment.findFirst({
      where: {
        id,
        companyId: user.companyId,  // isolamento multi-tenant
        status:    "CONFIRMED",
      },
      select: {
        id:            true,
        amount:        true,
        method:        true,
        reference:     true,
        paidAt:        true,
        confirmedAt:   true,
        receiptNumber: true,
        status:        true,
        notes:         true,
        // Fatura associada
        invoice: {
          select: {
            id:        true,
            number:    true,
            total:     true,
            issueDate: true,
            type:      true,
          },
        },
        // Indicar se recibo está disponível (sem expor URL directa)
        // receiptUrl: true — NUNCA expor
      },
    });

    // Verificar se o recibo PDF está disponível (sem expor URL)
    const rawPayment = await prisma.erpPayment.findFirst({
      where: { id, companyId: user.companyId },
      select: { receiptUrl: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...payment,
        hasReceipt: !!rawPayment?.receiptUrl,
      },
    });
  } catch (err) {
    console.error("[GET /api/portal/payments/[id]]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
