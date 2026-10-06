import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/expenses/[id]
 *  - { action: "pay", paidDate?, paymentMethod?, reference?, receiptUrl? } → PENDENTE → PAGO
 *  - { action: "cancel" }                                                  → PENDENTE → CANCELADO
 *  - { action: "reopen" } (ADMIN)                                          → PAGO → PENDENTE
 *  - sem action: edita campos permitidos (lista branca)
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  try {
    const body = await req.json();
    const current = await prisma.expense.findUnique({ where: { id: params.id } });
    if (!current) return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 });
    const actor = session.name || session.email;

    if (body.action === "pay") {
      if (current.status !== "PENDENTE") {
        return NextResponse.json({ error: `Só despesas pendentes podem ser pagas (estado actual: ${current.status}).` }, { status: 400 });
      }
      const paid = body.paidDate ? new Date(body.paidDate) : new Date();
      if (isNaN(paid.getTime()) || paid.getTime() > Date.now() + 24 * 3600 * 1000) {
        return NextResponse.json({ error: "Data de pagamento inválida (não pode ser futura)." }, { status: 400 });
      }
      const updated = await prisma.expense.update({
        where: { id: params.id },
        data: {
          status: "PAGO",
          paidDate: paid,
          paidBy: actor,
          paymentMethod: body.paymentMethod || current.paymentMethod,
          reference: body.reference || current.reference,
          receiptUrl: body.receiptUrl || current.receiptUrl,
        },
      });
      return NextResponse.json(updated);
    }

    if (body.action === "cancel") {
      if (current.status !== "PENDENTE") {
        return NextResponse.json({ error: "Só despesas pendentes podem ser canceladas." }, { status: 400 });
      }
      const updated = await prisma.expense.update({
        where: { id: params.id },
        data: { status: "CANCELADO", cancelledAt: new Date() },
      });
      return NextResponse.json(updated);
    }

    if (body.action === "reopen") {
      if (session.role !== AdminRole.ADMIN) {
        return NextResponse.json({ error: "Apenas ADMIN pode reabrir uma despesa." }, { status: 403 });
      }
      if (current.status !== "PAGO") {
        return NextResponse.json({ error: "Só despesas pagas podem ser reabertas." }, { status: 400 });
      }
      const updated = await prisma.expense.update({
        where: { id: params.id },
        data: { status: "PENDENTE", paidDate: null, paidBy: null },
      });
      return NextResponse.json(updated);
    }

    // Edição (lista branca). Despesas canceladas são só de leitura.
    if (current.status === "CANCELADO") {
      return NextResponse.json({ error: "Despesa cancelada não pode ser editada." }, { status: 400 });
    }
    const data: Record<string, unknown> = {};
    if (body.category !== undefined) data.category = String(body.category);
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.supplier !== undefined) data.supplier = body.supplier || null;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.receiptUrl !== undefined) data.receiptUrl = body.receiptUrl || null;
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod || null;
    if (body.reference !== undefined) data.reference = body.reference || null;
    if (body.expenseDate !== undefined) data.expenseDate = new Date(body.expenseDate);
    if (body.amount !== undefined) {
      const v = Number(body.amount);
      if (!Number.isFinite(v) || v <= 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
      data.amount = v;
    }
    const updated = await prisma.expense.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/expenses/:id]", err);
    Sentry.captureException(err, { tags: { route: "expenses/[id]" } });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao actualizar despesa: ${msg}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  try {
    const current = await prisma.expense.findUnique({ where: { id: params.id }, select: { status: true } });
    if (!current) return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 });
    if (current.status === "PAGO") {
      return NextResponse.json({ error: "Despesa paga não pode ser eliminada — reabra ou mantenha o registo para auditoria." }, { status: 400 });
    }
    await prisma.expense.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/expenses/:id]", err);
    Sentry.captureException(err, { tags: { route: "expenses/[id]" } });
    return NextResponse.json({ error: "Erro ao eliminar despesa." }, { status: 500 });
  }
}
