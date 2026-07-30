/**
 * GET /api/portal/payments
 *
 * Lista pagamentos ERP confirmados da empresa autenticada.
 * Filtros: period (YYYY-MM), method.
 * Paginação: page + limit (default 20).
 * Qualquer role autenticado pode aceder.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";

const VALID_METHODS  = ["BANK_TRANSFER","CASH","CHECK","MULTICAIXA","TPA","CREDITO"] as const;
const DEFAULT_LIMIT  = 20;
const MAX_LIMIT      = 100;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { searchParams } = req.nextUrl;
    const period = searchParams.get("period"); // "2026-07"
    const method = searchParams.get("method");
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
    const limit  = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));
    const skip   = (page - 1) * limit;

    if (method && !VALID_METHODS.includes(method as typeof VALID_METHODS[number])) {
      return NextResponse.json({ error: "Método de pagamento inválido." }, { status: 400 });
    }

    // Filtro por período (YYYY-MM) sobre paidAt
    let dateFilter: { gte?: Date; lte?: Date } | undefined;
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [year, month] = period.split("-").map(Number);
      dateFilter = {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0, 23, 59, 59),
      };
    }

    const where = {
      companyId: user.companyId,   // isolamento multi-tenant
      status:    "CONFIRMED",      // cliente só vê pagamentos confirmados
      ...(method ? { method } : {}),
      ...(dateFilter ? { paidAt: dateFilter } : {}),
    };

    const [payments, total] = await Promise.all([
      prisma.erpPayment.findMany({
        where,
        orderBy: { paidAt: "desc" },
        skip,
        take:    limit,
        select: {
          id:            true,
          amount:        true,
          method:        true,
          reference:     true,
          paidAt:        true,
          confirmedAt:   true,
          receiptNumber: true,
          status:        true,
          // NÃO expor receiptUrl directamente
          invoice: {
            select: { id: true, number: true, total: true },
          },
        },
      }),
      prisma.erpPayment.count({ where }),
    ]);

    return NextResponse.json({
      data:       payments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/portal/payments]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
