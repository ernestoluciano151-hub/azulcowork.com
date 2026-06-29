import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const month = searchParams.get("month");

  const where: Record<string, unknown> = {};
  if (category && category !== "ALL") where.category = category;
  if (status && status !== "ALL") where.status = status;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    where.expenseDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { expenseDate: "desc" },
    take: 200,
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [totalMes, totalAnual] = await Promise.all([
    prisma.expense.aggregate({ where: { expenseDate: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { expenseDate: { gte: startOfYear } }, _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    expenses,
    summary: {
      totalMes: totalMes._sum.amount || 0,
      totalAnual: totalAnual._sum.amount || 0,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const data = await req.json();
  const { category, description, amount, expenseDate, supplier, status, receiptUrl, notes } = data;

  if (!category || !description || !amount || !expenseDate) {
    return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      category,
      description,
      amount: Number(amount),
      expenseDate: new Date(expenseDate),
      supplier: supplier || null,
      status: status || "PAGO",
      receiptUrl: receiptUrl || null,
      notes: notes || null,
    },
  });

  return NextResponse.json(expense, { status: 201 });
}
