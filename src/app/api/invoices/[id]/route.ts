import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();

  // Keep totalAmount in sync with amount + iva - discount when not explicitly set
  if (body.amount !== undefined && body.totalAmount === undefined) {
    const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (existing) {
      const amount   = Number(body.amount);
      const discount = Number(body.discount ?? existing.discount ?? 0);
      const iva      = Number(body.iva      ?? existing.iva      ?? 0);
      const afterDisc = amount - discount;
      body.totalAmount = afterDisc + (afterDisc * iva / 100);
      body.balance     = Math.max(0, body.totalAmount - (existing.amountPaid || 0));
    }
  }

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data: body,
    include: { company: { select: { id: true, name: true } } },
  });

  return NextResponse.json(invoice);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  await prisma.invoice.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
