import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { recordFinancialHistory } from "@/lib/finance";
import { publish } from "@/lib/event-bus";
import "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const data = await req.json();

  if (data.status === "PAGO" && !data.paidDate) {
    data.paidDate = new Date();
  }

  // Ler estado anterior ANTES da transacção (representa snapshot pré-update)
  const before = await prisma.payment.findUnique({
    where: { id: params.id },
    include: { company: { select: { name: true } } },
  });

  // ── payment.update + recordFinancialHistory atómicos ────────────────────
  const payment = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: params.id },
      data,
      include: { company: { select: { id: true, name: true } } },
    });

    if (data.status === "PAGO" && before?.status !== "PAGO" && updated.companyId) {
      await recordFinancialHistory(tx, {
        companyId:   updated.companyId,
        type:        "PAGAMENTO",
        description: `Pagamento marcado como pago — ${updated.company?.name ?? "cliente"}`,
        amount:      updated.amount,
        method:      updated.paymentMethod || undefined,
        reference:   updated.id,
        createdBy:   session.name || session.email,
      });
    }

    return updated;
  });

  // Auto-notificações via Event Bus
  if (data.status === "PAGO" && before?.status !== "PAGO") {
    publish("payment.received", {
      paymentId:  payment.id,
      companyId:  payment.companyId ?? undefined,
      amount:     payment.amount,
      method:     payment.paymentMethod ?? undefined,
      paidDate:   payment.paidDate ?? new Date(),
      receivedBy: session.name || session.email,
    }).catch(() => {});
  }

  if (data.status === "ATRASADO" && before?.status !== "ATRASADO") {
    const daysOverdue = Math.max(0, Math.floor(
      (Date.now() - new Date(payment.dueDate).getTime()) / 86400000
    ));
    publish("payment.overdue", {
      paymentId:   payment.id,
      companyId:   payment.companyId ?? undefined,
      amount:      payment.amount,
      dueDate:     payment.dueDate,
      daysOverdue,
    }).catch(() => {});
  }

  return NextResponse.json(payment);
}
