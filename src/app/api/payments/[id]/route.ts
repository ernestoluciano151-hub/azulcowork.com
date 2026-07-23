import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordFinancialHistory } from "@/lib/finance";
import { publish } from "@/lib/event-bus";
import "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const data = await req.json();

  if (data.status === "PAGO" && !data.paidDate) {
    data.paidDate = new Date();
  }

  const before = await prisma.payment.findUnique({
    where: { id: params.id },
    include: { company: { select: { name: true } } },
  });

  const payment = await prisma.payment.update({
    where: { id: params.id },
    data,
    include: { company: { select: { id: true, name: true } } },
  });

  // only record history for company-linked payments
  if (data.status === "PAGO" && before?.status !== "PAGO" && payment.companyId) {
    await recordFinancialHistory(prisma, {
      companyId:   payment.companyId,
      type:        "PAGAMENTO",
      description: `Pagamento marcado como pago — ${payment.company?.name ?? "cliente"}`,
      amount:      payment.amount,
      method:      payment.paymentMethod || undefined,
      reference:   payment.id,
      createdBy:   session.name || session.email,
    });
  }

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
