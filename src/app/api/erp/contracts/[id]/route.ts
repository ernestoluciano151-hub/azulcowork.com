/**
 * /api/erp/contracts/[id] — Detalhe e actualização de contrato
 *
 * GET   — Detalhe completo com rentSchedules e erpInvoices
 * PATCH — Actualiza campos editáveis de um contrato DRAFT
 *
 * Docs: docs/05-erp/contracts-rent.md
 */

import { NextRequest, NextResponse }   from "next/server";
import { AdminRole }                   from "@prisma/client";
import { requireRole, requireSession } from "@/lib/auth";
import { getErpContract }              from "@/lib/erp-contract-service";
import { prisma }                      from "@/lib/prisma";
import "@/lib/bootstrap";

// ── GET /api/erp/contracts/[id] ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  try {
    const contract = await getErpContract(id);
    if (!contract) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
    return NextResponse.json(contract);
  } catch (err) {
    console.error("[GET /api/erp/contracts/[id]]", err);
    return NextResponse.json({ error: "Erro ao carregar contrato." }, { status: 500 });
  }
}

// ── PATCH /api/erp/contracts/[id] ─────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Corpo inválido." }, { status: 400 }); }

  // Apenas campos editáveis em DRAFT
  const contract = await prisma.erpContract.findUnique({
    where: { id, deletedAt: null },
  });
  if (!contract) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  if (contract.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Só contratos em DRAFT podem ser editados. Para alterações a contratos activos, use os endpoints específicos (suspend, terminate)." },
      { status: 409 }
    );
  }

  // Campos permitidos em PATCH
  const allowedFields = ["monthlyValue", "depositAmount", "endDate", "notes", "autoRenew", "renewalNoticeDays", "adjustmentRules", "signedAt"];
  const updateData: Record<string, unknown> = { updatedBy: session!.sub };
  for (const field of allowedFields) {
    if (field in body) {
      if ((field === "endDate" || field === "signedAt") && body[field]) {
        updateData[field] = new Date(body[field] as string);
      } else {
        updateData[field] = body[field];
      }
    }
  }

  try {
    const updated = await prisma.erpContract.update({
      where: { id },
      data:  updateData,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/erp/contracts/[id]]", err);
    return NextResponse.json({ error: "Erro ao actualizar contrato." }, { status: 500 });
  }
}
