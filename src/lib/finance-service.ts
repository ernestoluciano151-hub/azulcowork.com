/**
 * FinanceService — Central financial orchestrator.
 * All monetary operations (payment confirmation, invoice management,
 * liquidation notes, audit trails) must go through this service.
 */
import type { PrismaClient } from "@prisma/client";
import { recordFinancialHistory } from "@/lib/finance";
import { addTimeline } from "@/lib/timeline";
import { nextDocumentNumber } from "@/lib/document-numbering";

type TX = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
type DB = PrismaClient | TX;

export interface ConfirmPaymentInput {
  reservationId: string;
  amount: number;              // amount being paid now (may be partial)
  paymentMethod?: string | null;
  operationRef?: string | null;
  receiptUrl?: string | null;
  paidDate?: Date;
  createdBy?: string;
  ip?: string;
}

export interface ConfirmPaymentResult {
  invoiceNumber: string;
  noteNumber: string;
  invoiceStatus: string;
  amountPaid: number;
  balance: number;
  paidPercentage: number;
}

/**
 * confirmPayment — Full atomic chain:
 * 1. Load reservation + plan
 * 2. Find or create the Invoice (never duplicate)
 * 3. Create InvoicePayment installment
 * 4. Recompute amountPaid / balance / paidPercentage / status on Invoice
 * 5. Update Payment record (create if missing)
 * 6. Update Reservation status + paymentStatus
 * 7. Generate LiquidationNote (NL-YYYY-NNNNNN)
 * 8. recordFinancialHistory for linked company
 * 9. addTimeline
 * 10. FinancialAudit entry
 */
export async function confirmPayment(
  prisma: PrismaClient,
  input: ConfirmPaymentInput
): Promise<ConfirmPaymentResult> {
  const reservation = await prisma.reservation.findUnique({
    where:   { id: input.reservationId },
    include: { plan: true },
  });

  if (!reservation) throw new Error("Reserva não encontrada.");
  if (reservation.paymentStatus === "PAGO") throw new Error("Esta reserva já foi paga.");

  const paid = input.paidDate ?? new Date();
  const payAmount = input.amount > 0 ? input.amount : reservation.totalAmount;

  return prisma.$transaction(async (tx) => {
    // ── 1. Find or create Invoice ─────────────────────────────────────────
    let invoice = await tx.invoice.findFirst({
      where: { reservationId: reservation.id },
      include: { invoicePayments: true },
    });

    if (!invoice) {
      const invoiceNumber = await nextDocumentNumber(tx, "FT-SALA");

      invoice = await tx.invoice.create({
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
          paymentMethod: input.paymentMethod || null,
          status:        "PENDENTE",
          notes: `${reservation.reservationNumber} | ${reservation.totalHours.toFixed(1)}h | ${reservation.participants} participantes`,
        },
        include: { invoicePayments: true },
      });
    }

    // ── 2. Create InvoicePayment installment ─────────────────────────────
    await tx.invoicePayment.create({
      data: {
        invoiceId:     invoice.id,
        amount:        payAmount,
        paymentMethod: input.paymentMethod || null,
        operationRef:  input.operationRef  || null,
        receiptUrl:    input.receiptUrl    || null,
        paidDate:      paid,
        createdBy:     input.createdBy     || null,
      },
    });

    // ── 3. Recompute totals ───────────────────────────────────────────────
    const previousPaid = invoice.amountPaid ?? 0;
    const newAmountPaid = previousPaid + payAmount;
    const balance       = Math.max(0, invoice.totalAmount - newAmountPaid);
    const paidPct       = invoice.totalAmount > 0
      ? Math.min(100, (newAmountPaid / invoice.totalAmount) * 100)
      : 100;

    let invoiceStatus = "PARCIAL";
    if (balance <= 0)                      invoiceStatus = "LIQUIDADA";
    else if (previousPaid === 0)           invoiceStatus = "PENDENTE";
    else if (new Date() > invoice.dueDate) invoiceStatus = "EM_ATRASO";

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid:     newAmountPaid,
        balance,
        paidPercentage: paidPct,
        status:         invoiceStatus,
        paymentMethod:  input.paymentMethod || invoice.paymentMethod,
      },
    });

    // ── 4. Update or create Payment record ───────────────────────────────
    if (reservation.paymentId) {
      await tx.payment.update({
        where: { id: reservation.paymentId },
        data: {
          status:        balance <= 0 ? "PAGO" : "PENDENTE",
          paidDate:      paid,
          paymentMethod: input.paymentMethod || null,
          operationRef:  input.operationRef  || null,
          receiptUrl:    input.receiptUrl    || null,
        },
      });
    } else {
      const receiptNumber = await nextDocumentNumber(tx, "REC");

      const paymentRec = await tx.payment.create({
        data: {
          companyId:     reservation.companyId || null,
          reservationId: reservation.id,
          amount:        reservation.totalAmount,
          dueDate:       reservation.startDatetime,
          paidDate:      paid,
          status:        balance <= 0 ? "PAGO" : "PENDENTE",
          paymentMethod: input.paymentMethod || null,
          operationRef:  input.operationRef  || null,
          receiptUrl:    input.receiptUrl    || null,
          notes:         `${reservation.reservationNumber} — ${reservation.eventName}`,
          category:      "SALA_REUNIAO",
          receiptNumber,
        },
      });

      await tx.reservation.update({
        where: { id: reservation.id },
        data:  { paymentId: paymentRec.id },
      });
    }

    // ── 5. Update Reservation ─────────────────────────────────────────────
    const newPayStatus = balance <= 0 ? "PAGO" : "PENDENTE";
    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status:        balance <= 0 ? "CONFIRMADA" : reservation.status,
        paymentStatus: newPayStatus,
        paymentMethod: input.paymentMethod || null,
        operationRef:  input.operationRef  || null,
        receiptUrl:    input.receiptUrl    || null,
        invoiceId:     invoice.id,
        amountPaid:    newAmountPaid,
        paidDate:      balance <= 0 ? paid : null,
      },
    });

    // ── 6. Generate LiquidationNote ───────────────────────────────────────
    const noteNumber = await nextDocumentNumber(tx, "NL");

    await tx.liquidationNote.create({
      data: {
        noteNumber,
        invoiceId:     invoice.id,
        reservationId: reservation.id,
        companyId:     reservation.companyId || null,
        amountBilled:  invoice.totalAmount,
        amountPaid:    payAmount,
        balance,
        paymentMethod: input.paymentMethod || null,
        operationRef:  input.operationRef  || null,
        createdBy:     input.createdBy     || null,
      },
    });

    // ── 7. Financial history (company only) ───────────────────────────────
    if (reservation.companyId) {
      await recordFinancialHistory(tx, {
        companyId:   reservation.companyId,
        type:        "PAGAMENTO",
        description: `${invoice.invoiceNumber} — Sala ${reservation.plan.name} | ${reservation.reservationNumber}`,
        amount:      payAmount,
        method:      input.paymentMethod || undefined,
        reference:   invoice.id,
        createdBy:   input.createdBy,
      });
    }

    // ── 8. Timeline ───────────────────────────────────────────────────────
    await addTimeline(tx as DB, {
      type:          "PAGAMENTO_RECEBIDO",
      title:         `Pagamento recebido — ${invoice.invoiceNumber}`,
      description:   `${reservation.reservationNumber} | ${reservation.plan.name} | ${payAmount.toLocaleString("pt-PT")} AOA${balance > 0 ? ` | Saldo: ${balance.toLocaleString("pt-PT")} AOA` : " | LIQUIDADA"}`,
      companyId:     reservation.companyId || null,
      amount:        payAmount,
      referenceId:   reservation.id,
      referenceType: "Reservation",
      createdBy:     input.createdBy,
    });

    // ── 9. Audit trail ────────────────────────────────────────────────────
    await (tx as PrismaClient).financialAudit.create({
      data: {
        action:     "CONFIRM_PAYMENT",
        entityType: "Reservation",
        entityId:   reservation.id,
        companyId:  reservation.companyId || null,
        amount:     payAmount,
        method:     input.paymentMethod || null,
        reference:  invoice.invoiceNumber,
        createdBy:  input.createdBy     || null,
        ip:         input.ip            || null,
      },
    });

    return {
      invoiceNumber:  invoice.invoiceNumber,
      noteNumber,
      invoiceStatus,
      amountPaid:     newAmountPaid,
      balance,
      paidPercentage: paidPct,
    };
  });
}
