import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordFinancialHistory } from "@/lib/finance";

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

  return NextResponse.json(payment);
}
