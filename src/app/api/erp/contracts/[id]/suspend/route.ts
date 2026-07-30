/**
 * POST /api/erp/contracts/[id]/suspend
 * Suspende contrato ACTIVE → SUSPENDED. Requer ADMIN | FINANCEIRO.
 */
import { NextRequest, NextResponse }   from "next/server";
import { AdminRole }                   from "@prisma/client";
import { requireRole }                 from "@/lib/auth";
import { suspendErpContract }          from "@/lib/erp-contract-service";
import "@/lib/bootstrap";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { id }  = await params;
  let reason: string | undefined;
  try {
    const body = await req.json();
    reason = typeof body.reason === "string" ? body.reason : undefined;
  } catch { /* sem corpo é válido */ }

  try {
    const contract = await suspendErpContract(id, reason, session!.sub);
    return NextResponse.json(contract);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao suspender contrato.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
