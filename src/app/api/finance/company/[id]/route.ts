export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getCompanyFinanceSummary } from "@/lib/finance";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO);
  if (error) return error;

  const summary = await getCompanyFinanceSummary(prisma, params.id);
  if (!summary) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  // Fetch sala reservations for this company
  const reservations = await prisma.reservation.findMany({
    where:   { companyId: params.id, status: { not: "CANCELADA" } },
    include: { plan: true },
    orderBy: { startDatetime: "desc" },
    take:    50,
  });

  // serialise dates
  const { company, ...rest } = summary;
  return NextResponse.json({
    ...rest,
    company: {
      ...company,
      contractStart: company.contractStart.toISOString(),
      contractEnd:   company.contractEnd.toISOString(),
      createdAt:     company.createdAt.toISOString(),
      updatedAt:     company.updatedAt.toISOString(),
      payments: company.payments.map((p) => ({
        ...p,
        dueDate:   p.dueDate.toISOString(),
        paidDate:  p.paidDate  ? p.paidDate.toISOString()  : null,
        createdAt: p.createdAt.toISOString(),
      })),
      invoices: company.invoices.map((i) => ({
        ...i,
        issueDate: i.issueDate.toISOString(),
        dueDate:   i.dueDate.toISOString(),
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
      financialHistory: company.financialHistory.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      })),
    },
    reservations: reservations.map(r => ({
      ...r,
      startDatetime: r.startDatetime.toISOString(),
      endDatetime:   r.endDatetime.toISOString(),
      createdAt:     r.createdAt.toISOString(),
      updatedAt:     r.updatedAt.toISOString(),
    })),
  });
}
