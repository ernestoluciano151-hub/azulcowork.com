import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const payments = await prisma.payment.findMany({
    where: { companyId: params.id },
    orderBy: { dueDate: "desc" }
  });

  return NextResponse.json({ payments });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const { dueDate, paidDate, amount, status, notes } = body;

  if (!dueDate || !amount) {
    return NextResponse.json({ error: "dueDate e amount são obrigatórios." }, { status: 400 });
  }

  const payment = await prisma.payment.create({
    data: {
      companyId: params.id,
      dueDate: new Date(dueDate),
      paidDate: paidDate ? new Date(paidDate) : null,
      amount: Number(amount),
      status: status || "PENDENTE",
      notes: notes || null
    }
  });

  return NextResponse.json({ payment }, { status: 201 });
}
