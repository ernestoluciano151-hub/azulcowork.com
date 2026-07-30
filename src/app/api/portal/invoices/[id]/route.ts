/**
 * GET /api/portal/invoices/[id]
 *
 * Detalhe de fatura ERP com items, totais, estado e dados bancários.
 * Verifica isolamento: fatura deve pertencer à empresa do utilizador.
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

    const invoice = await prisma.erpInvoice.findFirst({
      where: {
        id,
        companyId: user.companyId,  // isolamento multi-tenant
      },
      select: {
        id:        true,
        number:    true,
        type:      true,
        status:    true,
        issueDate: true,
        dueDate:   true,
        subtotal:  true,
        taxRate:   true,
        taxAmount: true,
        total:     true,
        notes:     true,
        paidAt:    true,
        sentAt:    true,
        sentTo:    true,
        // NÃO expor pdfUrl directamente — usar /download para URL assinada
        items: {
          select: {
            id:          true,
            description: true,
            quantity:    true,
            unitPrice:   true,
            total:       true,
            accountCode: true,
          },
        },
        erpPayments: {
          where:  { status: "CONFIRMED" },
          select: {
            id:          true,
            amount:      true,
            method:      true,
            paidAt:      true,
            confirmedAt: true,
            receiptNumber: true,
          },
          orderBy: { paidAt: "desc" },
        },
        // Dados bancários para pagamento (constantes — não vêm da BD)
      },
    });

    // 404 genérico — não revelar se pertence a outra empresa
    if (!invoice) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    // Adicionar dados bancários do Azul Coworking para pagamento
    const bankDetails = {
      banco:     "BCS",
      iban:      "AO06007000000212870210113",
      swift:     "CDTSAOLU",
      titular:   "VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA",
      nif:       "5002174308",
      referencia: invoice.number,
    };

    return NextResponse.json({ data: { ...invoice, bankDetails } });
  } catch (err) {
    console.error("[GET /api/portal/invoices/[id]]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
