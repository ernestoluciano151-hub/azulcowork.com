/**
 * POST /api/erp/contracts/[id]/terminate
 * Rescinde contrato ACTIVE | SUSPENDED → TERMINATED. Cancela parcelas futuras.
 * Requer ADMIN.
 */
import { NextRequest, NextResponse } from "next/server";
import { AdminRole }                 from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { terminateErpContract }      from "@/lib/erp-contract-service";
import "@/lib/bootstrap";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { id } = await params;

  let reason = "Rescisão de contrato";
  try {
    const body = await req.json();
    if (typeof body.reason === "string" && body.reason.trim()) reason = body.reason.trim();
  } catch { /* sem corpo é válido */ }

  try {
    const contract = await terminateErpContract(id, reason, session!.sub);
    return NextResponse.json(contract);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao rescindir contrato.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
