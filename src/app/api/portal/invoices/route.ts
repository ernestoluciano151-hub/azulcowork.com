/**
 * GET /api/portal/invoices
 *
 * Lista faturas ERP da empresa autenticada.
 * Filtros: status, period (YYYY-MM).
 * Paginação: page + limit (default 20).
 * Qualquer role autenticado pode aceder.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["DRAFT","ISSUED","SENT","PAID","OVERDUE","PARTIALLY_PAID","CANCELLED","VOID"] as const;
const DEFAULT_LIMIT  = 20;
const MAX_LIMIT      = 100;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const period = searchParams.get("period"); // "2026-07"
    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit  = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));
    const skip   = (page - 1) * limit;

    // Validar status
    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    // Filtro por período (YYYY-MM)
    let dateFilter: { gte?: Date; lte?: Date } | undefined;
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [year, month] = period.split("-").map(Number);
      dateFilter = {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0, 23, 59, 59),
      };
    }

    const where = {
      companyId: user.companyId,  // isolamento multi-tenant
      ...(status ? { status } : {}),
      ...(dateFilter ? { issueDate: dateFilter } : {}),
    };

    const [invoices, total] = await Promise.all([
      prisma.erpInvoice.findMany({
        where,
        orderBy: { issueDate: "desc" },
        skip,
        take:    limit,
        select: {
          id:        true,
          number:    true,
          type:      true,
          status:    true,
          issueDate: true,
          dueDate:   true,
          subtotal:  true,
          taxRate:   true,
          taxAmount: true,
          total:     true,
          paidAt:    true,
          sentAt:    true,
        },
      }),
      prisma.erpInvoice.count({ where }),
    ]);

    return NextResponse.json({
      data:       invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/portal/invoices]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
