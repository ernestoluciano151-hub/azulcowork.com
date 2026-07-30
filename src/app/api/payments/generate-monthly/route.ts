import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const afterNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  // Get all active companies
  const companies = await prisma.company.findMany({
    where: { contractStatus: "ATIVO" },
  });

  let created = 0;
  let skipped = 0;

  for (const company of companies) {
    // Check if payment already exists for this company in next month
    const existing = await prisma.payment.findFirst({
      where: {
        companyId: company.id,
        dueDate: { gte: nextMonth, lt: afterNextMonth },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.payment.create({
      data: {
        companyId: company.id,
        dueDate: nextMonth,
        amount: company.rentAmount,
        status: "PENDENTE",
      },
    });
    created++;
  }

  return NextResponse.json({
    success: true,
    created,
    skipped,
    message: `${created} pagamento(s) gerado(s), ${skipped} já existia(m).`,
  });
}
