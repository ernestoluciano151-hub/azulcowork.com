/**
 * POST /api/reservations/[id]/receive-payment
 * Confirm payment via the central FinanceService.
 * Supports full and partial payments.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { confirmPayment } from "@/lib/finance-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const body = await req.json();
  const { paymentMethod, operationRef, receiptUrl, paidDate, amount } = body;

  try {
    const result = await confirmPayment(prisma, {
      reservationId: params.id,
      amount:        Number(amount) || 0,
      paymentMethod: paymentMethod || null,
      operationRef:  operationRef  || null,
      receiptUrl:    receiptUrl    || null,
      paidDate:      paidDate ? new Date(paidDate) : undefined,
      createdBy:     session.name || session.email,
      ip:            req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar pagamento.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
