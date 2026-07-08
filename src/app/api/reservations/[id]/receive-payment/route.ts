/**
 * POST /api/reservations/[id]/receive-payment
 * Confirm payment for a PAGAR_NO_DIA reservation.
 * Updates Payment to PAGO, creates Invoice, updates Reservation.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordFinancialHistory } from "@/lib/finance";
import { addTimeline } from "@/lib/timeline";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const { paymentMethod, operationRef, receiptUrl, paidDate } = body;

  const reservation = await prisma.reservation.findUnique({
    where:   { id: params.id },
    include: { plan: true },
  });

  if (!reservation) return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  if (reservation.paymentStatus === "PAGO") {
    return NextResponse.json({ error: "Esta reserva já foi paga." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const paid = paidDate ? new Date(paidDate) : new Date();

    // Update existing pending payment if exists
    if (reservation.paymentId) {
      await tx.payment.update({
        where: { id: reservation.paymentId },
        data: {
          status:        "PAGO",
          paidDate:      paid,
          paymentMethod: paymentMethod || null,
          operationRef:  operationRef  || null,
          receiptUrl:    receiptUrl    || null,
        },
      });
    } else {
      // Create payment if not yet created
      const recYear  = new Date().getFullYear();
      const recCount = await tx.payment.count({ where: { receiptNumber: { startsWith: `REC-${recYear}-` } } });
      const receiptNumber = `REC-${recYear}-${String(recCount + 1).padStart(6, "0")}`;

      const paymentRec = await tx.payment.create({
        data: {
          companyId:     reservation.companyId || null,
          reservationId: reservation.id,
          amount:        reservation.totalAmount,
          dueDate:       reservation.startDatetime,
          paidDate:      paid,
          status:        "PAGO",
          paymentMethod: paymentMethod || null,
          operationRef:  operationRef  || null,
          receiptUrl:    receiptUrl    || null,
          notes:         `${reservation.reservationNumber} — ${reservation.eventName}`,
          category:      "SALA_REUNIAO",
          receiptNumber,
        },
      });

      await tx.reservation.update({ where: { id: reservation.id }, data: { paymentId: paymentRec.id } });
    }

    // Generate invoice
    const invYear  = new Date().getFullYear();
    const invCount = await tx.invoice.count({ where: { invoiceNumber: { startsWith: `FT-SALA-${invYear}-` } } });
    const invoiceNumber = `FT-SALA-${invYear}-${String(invCount + 1).padStart(6, "0")}`;

    const invoiceRec = await tx.invoice.create({
      data: {
        invoiceNumber,
        companyId:     reservation.companyId || null,
        reservationId: reservation.id,
        serviceType:   `Sala de Reunião — ${reservation.plan.name}`,
        amount:        reservation.amount,
        discount:      reservation.discount,
        iva:           reservation.iva,
        totalAmount:   reservation.totalAmount,
        issueDate:     paid,
        dueDate:       reservation.startDatetime,
        paymentMethod: paymentMethod || null,
        status:        "PAGO",
        notes: `${reservation.reservationNumber} | ${reservation.totalHours.toFixed(1)}h | ${reservation.participants} participantes`,
      },
    });

    // Update reservation
    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status:        "CONFIRMADA",
        paymentStatus: "PAGO",
        paymentMethod: paymentMethod || null,
        operationRef:  operationRef  || null,
        receiptUrl:    receiptUrl    || null,
        invoiceId:     invoiceRec.id,
      },
    });

    // Financial history for linked company
    if (reservation.companyId) {
      await recordFinancialHistory(tx as Parameters<typeof recordFinancialHistory>[0], {
        companyId:   reservation.companyId,
        type:        "PAGAMENTO",
        description: `${invoiceNumber} — Sala ${reservation.plan.name} | ${reservation.reservationNumber}`,
        amount:      reservation.totalAmount,
        method:      paymentMethod || undefined,
        reference:   reservation.paymentId || undefined,
        createdBy:   session.name || session.email,
      });
    }

    // Add timeline entry
    await addTimeline(tx, {
      type:          "PAGAMENTO_RECEBIDO",
      title:         `Pagamento recebido — ${invoiceNumber}`,
      description:   `${reservation.reservationNumber} | ${reservation.plan.name} | ${reservation.totalAmount.toLocaleString("pt-PT")} AOA`,
      companyId:     reservation.companyId || null,
      amount:        reservation.totalAmount,
      referenceId:   reservation.id,
      referenceType: "Reservation",
      createdBy:     session.name || session.email,
    });

    return { invoiceNumber };
  });

  return NextResponse.json({ ok: true, invoiceNumber: result.invoiceNumber });
}
