import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { syncExpenseToErp } from "@/lib/expense-erp-bridge";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/expenses/sync-erp — ADMIN.
 * Regista no ERP as despesas CRM já PAGAS e ainda não contabilizadas (lote de 40,
 * cronológico; repetir até `restantes` = 0). Idempotente.
 */
export async function POST() {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  try {
    const batch = await prisma.expense.findMany({
      where: { status: "PAGO", erpExpenseId: null },
      orderBy: { expenseDate: "asc" },
      take: 40,
      select: { id: true },
    });
    let ok = 0;
    const falhas: { id: string; error: string }[] = [];
    for (const e of batch) {
      const r = await syncExpenseToErp(e.id, session.sub);
      if (r.ok) ok++; else falhas.push({ id: e.id, error: r.error });
    }
    const restantes = await prisma.expense.count({ where: { status: "PAGO", erpExpenseId: null } });
    return NextResponse.json({ sincronizadas: ok, falhas, restantes });
  } catch (err) {
    console.error("[POST /api/admin/expenses/sync-erp]", err);
    Sentry.captureException(err, { tags: { route: "expenses/sync-erp" } });
    return NextResponse.json({ error: "Erro ao sincronizar despesas com o ERP." }, { status: 500 });
  }
}
