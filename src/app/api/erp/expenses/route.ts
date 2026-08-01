/**
 * GET  /api/erp/expenses  — listagem de despesas (ADMIN | FINANCEIRO | VIEWER)
 * POST /api/erp/expenses  — cria despesa (ADMIN | FINANCEIRO)
 *
 * Query params (GET): categoryId, costCenterId, status, companyId, page, pageSize
 * Body (POST): { categoryId, description, amount, dueDate, costCenterId?,
 *               supplierName?, supplierNif?, recurrence?, receiptUrl?, notes?, companyId? }
 */

import { NextRequest, NextResponse }    from "next/server";
import { AdminRole, ErpExpenseStatus }  from "@prisma/client";
import { requireRole, requireSession }  from "@/lib/auth";
import { isApiRateLimited }             from "@/lib/rateLimit";
import {
  createErpExpense,
  listErpExpenses,
}                                       from "@/lib/erp-expense-service";
import "@/lib/bootstrap";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { error } = await requireSession(req);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const page     = parseInt(searchParams.get("page")     ?? "1",  10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

  const statusParam = searchParams.get("status");
  const status = statusParam
    ? (statusParam as ErpExpenseStatus)
    : undefined;

  try {
    const result = await listErpExpenses({
      categoryId:   searchParams.get("categoryId")   ?? undefined,
      costCenterId: searchParams.get("costCenterId") ?? undefined,
      companyId:    searchParams.get("companyId")    ?? undefined,
      status,
      page,
      pageSize,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar despesas.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  if (await isApiRateLimited(req)) {
    return NextResponse.json({ error: "Rate limit excedido." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { categoryId, description, amount, dueDate } = body;

  if (!categoryId || typeof categoryId !== "string")
    return NextResponse.json({ error: "categoryId é obrigatório." }, { status: 422 });
  if (!description || typeof description !== "string")
    return NextResponse.json({ error: "description é obrigatória." }, { status: 422 });
  if (typeof amount !== "number" || amount <= 0)
    return NextResponse.json({ error: "amount deve ser número positivo (AOA)." }, { status: 422 });
  if (!dueDate || isNaN(Date.parse(String(dueDate))))
    return NextResponse.json({ error: "dueDate é obrigatória e deve ser uma data válida." }, { status: 422 });

  try {
    const expense = await createErpExpense(
      {
        categoryId,
        description,
        amount,
        dueDate:      new Date(String(dueDate)),
        costCenterId: typeof body.costCenterId === "string" ? body.costCenterId : undefined,
        supplierName: typeof body.supplierName === "string" ? body.supplierName : undefined,
        supplierNif:  typeof body.supplierNif  === "string" ? body.supplierNif  : undefined,
        receiptUrl:   typeof body.receiptUrl   === "string" ? body.receiptUrl   : undefined,
        notes:        typeof body.notes        === "string" ? body.notes        : undefined,
        companyId:    typeof body.companyId    === "string" ? body.companyId    : undefined,
      },
      session!.sub
    );
    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar despesa.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
