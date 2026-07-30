/**
 * GET   /api/erp/expenses/[id]  — detalhe da despesa (requireSession)
 * PATCH /api/erp/expenses/[id]  — actualiza despesa PENDING (ADMIN | FINANCEIRO)
 *                                  Apenas campos editáveis antes de aprovação.
 */

import { NextRequest, NextResponse }   from "next/server";
import { AdminRole }                   from "@prisma/client";
import { requireRole, requireSession } from "@/lib/auth";
import { getErpExpense }               from "@/lib/erp-expense-service";
import { prisma }                      from "@/lib/prisma";
import "@/lib/bootstrap";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession(req);
  if (error) return error;

  const { id } = await params;

  try {
    const expense = await getErpExpense(id);
    return NextResponse.json(expense);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao obter despesa.";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    const expense = await prisma.erpExpense.findUnique({ where: { id } });
    if (!expense || expense.deletedAt)
      return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 });

    if (expense.status !== "PENDING")
      return NextResponse.json(
        { error: `Apenas despesas PENDING podem ser editadas (actual: ${expense.status}).` },
        { status: 409 }
      );

    const allowed = ["description", "amount", "dueDate", "supplierName", "supplierNif",
                     "notes", "receiptUrl", "costCenterId"];
    const data: Record<string, unknown> = {};

    for (const key of allowed) {
      if (key in body) {
        if (key === "amount") {
          const v = body[key];
          if (typeof v !== "number" || v <= 0)
            return NextResponse.json({ error: "amount deve ser número positivo." }, { status: 422 });
          data[key] = Math.round(v);
        } else if (key === "dueDate") {
          const v = String(body[key]);
          if (isNaN(Date.parse(v)))
            return NextResponse.json({ error: "dueDate inválida." }, { status: 422 });
          data[key] = new Date(v);
        } else {
          data[key] = body[key];
        }
      }
    }

    const updated = await prisma.erpExpense.update({
      where:   { id },
      data:    data as Parameters<typeof prisma.erpExpense.update>[0]["data"],
      include: { category: true, costCenter: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao actualizar despesa.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
