/**
 * GET /api/portal/contracts
 *
 * Lista contratos ERP da empresa autenticada (activos e histórico).
 * Qualquer role autenticado pode aceder.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const contracts = await prisma.erpContract.findMany({
      where:   { companyId: user.companyId, deletedAt: null },
      orderBy: { startDate: "desc" },
      select: {
        id:           true,
        planType:     true,
        startDate:    true,
        endDate:      true,
        monthlyValue: true,
        depositAmount:true,
        depositStatus:true,
        status:       true,
        autoRenew:    true,
        signedAt:     true,
        createdAt:    true,
      },
    });

    return NextResponse.json({ data: contracts });
  } catch (err) {
    console.error("[GET /api/portal/contracts]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
