import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO);
  if (error) return error;

  const now = new Date();
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
  const in15 = new Date(now); in15.setDate(in15.getDate() + 15);
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
  const in60 = new Date(now); in60.setDate(in60.getDate() + 60);

  const [expiringContracts, overduePayments] = await Promise.all([
    prisma.company.findMany({
      where: {
        contractEnd: { lte: in60 },
        contractStatus: { notIn: ["ENCERRADO"] },
        // Exclui clientes eventuais de sala de reunião — não têm contrato
        // real, a data é apenas um placeholder técnico.
        category: "SALA_PRIVADA",
      },
      orderBy: { contractEnd: "asc" }
    }),
    prisma.payment.findMany({
      where: { status: "ATRASADO" },
      include: { company: true },
      orderBy: { dueDate: "asc" }
    })
  ]);

  const alerts = expiringContracts.map((c) => {
    const daysLeft = Math.ceil((c.contractEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let urgency: "expired" | "critical" | "warning" | "info" = "info";
    if (daysLeft <= 0) urgency = "expired";
    else if (daysLeft <= 7) urgency = "critical";
    else if (daysLeft <= 15) urgency = "warning";
    else if (daysLeft <= 30) urgency = "info";
    return { ...c, daysLeft, urgency };
  });

  return NextResponse.json({ alerts, overduePayments });
}
