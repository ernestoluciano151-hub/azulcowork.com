import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { recordFinancialHistory } from "@/lib/finance";
import { nextDocumentNumber } from "@/lib/document-numbering";
import { isApiRateLimited } from "@/lib/rateLimit";
import { recordAudit, actorFromSession } from "@/lib/audit-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO, AdminRole.COMERCIAL);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status    = searchParams.get("status");
  const month     = searchParams.get("month");
  const q         = searchParams.get("q");
  const companyId = searchParams.get("companyId");

  const where: Record<string, unknown> = {};
  if (status && status !== "ALL") where.status = status;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    where.dueDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (q)         where.OR = [
    { company: { name: { contains: q, mode: "insensitive" } } },
    { notes:   { contains: q, mode: "insensitive" } },
  ];
  if (companyId) where.companyId = companyId;

  const payments = await prisma.payment.findMany({
    where,
    include: { company: { select: { id: true, name: true } } },
    orderBy: { dueDate: "desc" },
    take: 200,
  });

  const [sumPago, sumPendente, sumAtrasado] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "PAGO"     }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PENDENTE" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "ATRASADO" }, _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    payments,
    summary: {
      pago:      sumPago._sum.amount     || 0,
      pendente:  sumPendente._sum.amount || 0,
      atrasado:  sumAtrasado._sum.amount || 0,
    },
  });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "payments")) {
    return NextResponse.json({ error: "Demasiados pedidos. Aguarde um momento." }, { status: 429 });
  }

  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const data = await req.json();
  const {
    companyId, amount, dueDate, paidDate,
    paymentMethod, notes, status, category,
    receiptUrl, doc2Url, operationRef,
  } = data;

  if (!companyId || !amount || !dueDate) {
    return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
  }

  const isPago    = (status || "PENDENTE") === "PAGO";
  const amountNum = Number(amount);

  // ── auto-gerar número de recibo ──────────────────────────────────────────
  // ── saldo anterior calculado ANTES da transacção (representa estado pré-pagamento) ──
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  let previousBalance: number | null = null;
  if (company) {
    const paidAgg = await prisma.payment.aggregate({
      where: { companyId, status: "PAGO" },
      _sum: { amount: true },
    });
    const { calcTotalContracted } = await import("@/lib/finance");
    const totalContracted = calcTotalContracted(company.rentAmount, company.contractStart, company.contractEnd);
    previousBalance = totalContracted - (paidAgg._sum.amount ?? 0);
  }

  // ── payment.create + recordFinancialHistory atómicos ────────────────────
  const payment = await prisma.$transaction(async (tx) => {
    const receiptNumber = await nextDocumentNumber(tx, "REC");

    const created = await tx.payment.create({
      data: {
        companyId,
        amount:          amountNum,
        dueDate:         new Date(dueDate),
        paidDate:        isPago ? (paidDate ? new Date(paidDate) : new Date()) : null,
        paymentMethod:   paymentMethod || null,
        notes:           notes || null,
        status:          status || "PENDENTE",
        category:        category || null,
        receiptUrl:      receiptUrl || null,
        doc2Url:         doc2Url || null,
        operationRef:    operationRef || null,
        receiptNumber,
        previousBalance,
      },
      include: { company: { select: { id: true, name: true } } },
    });

    if (isPago && companyId) {
      await recordFinancialHistory(tx, {
        companyId,
        type:        "PAGAMENTO",
        description: `${receiptNumber} — ${created.company?.name ?? "empresa"}`,
        amount:      amountNum,
        method:      paymentMethod || undefined,
        reference:   created.id,
        createdBy:   session.name || session.email,
      });
    }

    return created;
  });

  // Audit: PAYMENT_CREATED — post-commit, nunca bloqueia resposta
  recordAudit({
    actor:     actorFromSession(session),
    action:    "PAYMENT_CREATED",
    entity:    "Payment",
    entityId:  payment.id,
    entityRef: payment.receiptNumber ?? undefined,
    ipAddress: ip,
    after: {
      amount:        payment.amount,
      status:        payment.status,
      companyId:     payment.companyId,
      receiptNumber: payment.receiptNumber,
      dueDate:       payment.dueDate,
    },
  }).catch(err => console.error("[Audit] PAYMENT_CREATED:", err));

  return NextResponse.json(payment, { status: 201 });
}
