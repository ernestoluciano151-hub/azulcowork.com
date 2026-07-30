/**
 * POST /api/erp/contracts/[id]/activate
 *
 * Activa um contrato DRAFT → ACTIVE e gera as parcelas mensais (ErpRentSchedule).
 * Apenas ADMIN e FINANCEIRO.
 *
 * Docs: docs/05-erp/contracts-rent.md#4-geração-de-rentschedule
 */

import { NextRequest, NextResponse }   from "next/server";
import { AdminRole }                   from "@prisma/client";
import { requireRole }                 from "@/lib/auth";
import { activateErpContract }         from "@/lib/erp-contract-service";
import "@/lib/bootstrap";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { id } = await params;

  try {
    const contract = await activateErpContract(id, session!.sub);
    return NextResponse.json(contract);
  } catch (err) {
    console.error("[POST /api/erp/contracts/[id]/activate]", err);
    const msg = err instanceof Error ? err.message : "Erro ao activar contrato.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
