import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const STATUSES = ["PAGO", "PENDENTE", "CANCELADO"] as const;

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const month = searchParams.get("month");

    const where: Record<string, unknown> = {};
    if (category && category !== "ALL") where.category = category;
    if (status && status !== "ALL") where.status = status;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
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

    // Pago conta pela data de pagamento (caixa); pendente é compromisso em aberto.
    const paidWhere = (from: Date) => ({
      status: "PAGO",
      OR: [{ paidDate: { gte: from } }, { paidDate: null, expenseDate: { gte: from } }],
    });
    const [totalMes, totalAnual, pendente, vencido] = await Promise.all([
      prisma.expense.aggregate({ where: paidWhere(startOfMonth), _sum: { amount: true } }),
      prisma.expense.aggregate({ where: paidWhere(startOfYear), _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { status: "PENDENTE" }, _sum: { amount: true }, _count: { id: true } }),
      prisma.expense.aggregate({ where: { status: "PENDENTE", expenseDate: { lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } }, _sum: { amount: true }, _count: { id: true } }),
    ]);

    return NextResponse.json({
      expenses,
      summary: {
        totalMes: totalMes._sum.amount || 0,
        totalAnual: totalAnual._sum.amount || 0,
        totalPendente: pendente._sum.amount || 0,
        countPendente: pendente._count.id,
        totalVencido: vencido._sum.amount || 0,
        countVencido: vencido._count.id,
      },
    });
  } catch (err) {
    console.error("[GET /api/expenses]", err);
    Sentry.captureException(err, { tags: { route: "expenses" } });
    return NextResponse.json({ error: "Erro ao listar despesas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  try {
    const data = await req.json();
    const { category, description, amount, expenseDate, supplier, status, receiptUrl, notes, paymentMethod, reference, paidDate } = data;

    const value = Number(amount);
    if (!category || !description || !expenseDate || !Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: "Categoria, descrição, data e valor (> 0) são obrigatórios." }, { status: 400 });
    }
    const st = status || "PAGO";
    if (!(STATUSES as readonly string[]).includes(st) || st === "CANCELADO") {
      return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
    }
    const actor = session.name || session.email;

    const expense = await prisma.expense.create({
      data: {
        category: String(category),
        description: String(description).trim(),
        amount: value,
        expenseDate: new Date(expenseDate),
        supplier: supplier || null,
        status: st,
        receiptUrl: receiptUrl || null,
        notes: notes || null,
        paymentMethod: paymentMethod || null,
        reference: reference || null,
        createdBy: actor,
        ...(st === "PAGO" ? { paidDate: paidDate ? new Date(paidDate) : new Date(expenseDate), paidBy: actor } : {}),
      },
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    console.error("[POST /api/expenses]", err);
    Sentry.captureException(err, { tags: { route: "expenses" } });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao criar despesa: ${msg}` }, { status: 500 });
  }
}
