/**
 * GET /api/portal/contracts/[id]
 *
 * Detalhe de contrato ERP com ErpRentSchedules e documentos associados.
 * Verifica isolamento: contrato deve pertencer à empresa do utilizador.
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

    const contract = await prisma.erpContract.findFirst({
      where: {
        id,
        companyId: user.companyId,  // isolamento multi-tenant
        deletedAt: null,
      },
      select: {
        id:                true,
        planType:          true,
        startDate:         true,
        endDate:           true,
        monthlyValue:      true,
        depositAmount:     true,
        depositStatus:     true,
        depositPaidAt:     true,
        depositReturnedAt: true,
        status:            true,
        autoRenew:         true,
        renewalNoticeDays: true,
        notes:             true,
        signedAt:          true,
        terminatedAt:      true,
        terminationReason: true,
        createdAt:         true,
        updatedAt:         true,
        // Parcelas mensais (max 12 últimas + próximas pendentes)
        rentSchedules: {
          orderBy: { dueDate: "desc" },
          take:    24,
          select: {
            id:       true,
            dueDate:  true,
            amount:   true,
            status:   true,
            invoiceId:true,
          },
        },
      },
    });

    // 404 genérico — não revelar se o contrato existe mas pertence a outra empresa
    if (!contract) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: contract });
  } catch (err) {
    console.error("[GET /api/portal/contracts/[id]]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
