import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole, Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { recordFinancialHistory } from "@/lib/finance";
import { addTimeline } from "@/lib/timeline";
import { notifyReservationCreated } from "@/lib/notifications";
import { nextDocumentNumber } from "@/lib/document-numbering";
import { publish } from "@/lib/event-bus";
import "@/lib/bootstrap";
import { recordAudit, actorFromSession } from "@/lib/audit-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from        = searchParams.get("from");
  const to          = searchParams.get("to");
  const status      = searchParams.get("status");
  const payStatus   = searchParams.get("paymentStatus");
  const companyId   = searchParams.get("companyId");
  const page        = parseInt(searchParams.get("page") || "1", 10);
  const limit       = parseInt(searchParams.get("limit") || "100", 10);

  const where: Record<string, unknown> = {};
  if (status && status !== "ALL") where.status = status;
  if (payStatus && payStatus !== "ALL") where.paymentStatus = payStatus;
  if (companyId) where.companyId = companyId;
  if (from || to) {
    where.startDatetime = {};
    if (from) (where.startDatetime as Record<string, unknown>).gte = new Date(from);
    if (to)   (where.startDatetime as Record<string, unknown>).lte = new Date(to);
  }

  const [reservations, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: { startDatetime: "asc" },
      include: { plan: true, company: { select: { id: true, name: true, nif: true } } },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.reservation.count({ where }),
  ]);

  return NextResponse.json({ reservations, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const body = await req.json();
  const {
    eventName, companyName, companyId, responsible, email, whatsapp,
    planId, participants, startDatetime, endDatetime,
    coffeeBreak, observations, isCustomPricing, customRequest,
    paymentOption, amount, discount, iva, totalAmount,
    paymentMethod, operationRef, receiptUrl, financialNotes,
    amountPaid, paidDate, paymentTiming, selectedLeadId,
  } = body;

  if (!eventName || !responsible || !planId || !startDatetime || !endDatetime) {
    return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
  }

  const start      = new Date(startDatetime);
  const end        = new Date(endDatetime);
  const totalHours = (end.getTime() - start.getTime()) / 3600000;

  if (end <= start) {
    return NextResponse.json({ error: "A hora de fim deve ser posterior à hora de início." }, { status: 400 });
  }

  const plan = await prisma.meetingPlan.findUnique({ where: { id: planId } });
  if (!plan) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  if (isCustomPricing && plan.customPricingAllowed && plan.minHoursForCustom) {
    if (totalHours < plan.minHoursForCustom) {
      return NextResponse.json({ error: `Plano Personalizado requer mín. ${plan.minHoursForCustom}h.` }, { status: 400 });
    }
  }

  const opt = paymentOption || "PAGAR_NO_DIA";
  let reservationStatus = "CONFIRMADA";
  let paymentStatus     = "PENDENTE";

  if (opt === "PAGAR_AGORA")  { reservationStatus = "CONFIRMADA"; paymentStatus = "PAGO"; }
  if (opt === "PAGAR_NO_DIA") { reservationStatus = "RESERVADO";  paymentStatus = "PENDENTE"; }
  if (opt === "FACTURAR")     { reservationStatus = "CONFIRMADA"; paymentStatus = "FACTURADO"; }
  if (opt === "ISENTO")       { reservationStatus = "CONFIRMADA"; paymentStatus = "ISENTO"; }
  if (isCustomPricing)        { reservationStatus = "PENDENTE_APROVACAO"; }

  const finalTotal  = Number(totalAmount) || 0;
  const finalAmount = Number(amount)      || 0;
  const finalDisc   = Number(discount)    || 0;
  const finalIva    = Number(iva)         || 0;

  let result: Awaited<ReturnType<typeof runTransaction>>;
  try {
    result = await runTransaction();
  } catch (e) {
    if (e instanceof ReservationConflictError) {
      return NextResponse.json({ error: "Conflito: já existe uma reserva neste período." }, { status: 409 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      return NextResponse.json({ error: "Conflito de concorrência. Tente novamente." }, { status: 409 });
    }
    throw e;
  }

  async function runTransaction() {
    return prisma.$transaction(async (tx) => {
      // ── Conflict check DENTRO da transacção serializable ─────────────────────
      const conflict = await tx.reservation.findFirst({
        where: {
          status: { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
          AND: [{ startDatetime: { lt: end } }, { endDatetime: { gt: start } }],
        },
      });
      if (conflict) throw new ReservationConflictError();

      // ── Numeração DENTRO da transacção (evita race condition) ────────────────
      const reservationNumber = await nextDocumentNumber(tx, "RES");

      const reservation = await tx.reservation.create({
        data: {
          reservationNumber,
          eventName,
          companyName:     companyName  || null,
          companyId:       companyId    || null,
          responsible,
          email:           email        || null,
          whatsapp:        whatsapp     || null,
          planId,
          participants:    Number(participants) || 1,
          startDatetime:   start,
          endDatetime:     end,
          totalHours,
          coffeeBreak:     coffeeBreak  ?? false,
          observations:    observations || null,
          status:          reservationStatus,
          isCustomPricing: isCustomPricing ?? false,
          customRequest:   customRequest  || null,
          paymentOption:   opt,
          amount:          finalAmount,
          discount:        finalDisc,
          iva:             finalIva,
          totalAmount:     finalTotal,
          paymentStatus,
          paymentMethod:   opt === "PAGAR_AGORA" ? (paymentMethod || null) : null,
          operationRef:    opt === "PAGAR_AGORA" ? (operationRef  || null) : null,
          receiptUrl:      opt === "PAGAR_AGORA" ? (receiptUrl    || null) : null,
          financialNotes:  financialNotes || null,
          amountPaid:      Number(amountPaid) || 0,
          paidDate:        paidDate ? new Date(paidDate) : null,
        },
        include: { plan: true },
      });

      let paymentRec = null;
      let invoiceRec = null;

      let noteNumber: string | null = null;

      if (opt === "PAGAR_AGORA" && finalTotal > 0) {
        const finalAmountPaid = Number(amountPaid) || finalTotal;
        const isPartial       = paymentTiming === "PARCIAL" && finalAmountPaid < finalTotal;
        const invoiceStatus   = isPartial ? "PARCIAL" : "PAGO";
        const reservPayStatus = isPartial ? "PARCIAL" : "PAGO";

        const receiptNumber = await nextDocumentNumber(tx, "REC");

        paymentRec = await tx.payment.create({
          data: {
            companyId:     companyId    || null,
            reservationId: reservation.id,
            amount:        finalAmountPaid,
            dueDate:       start,
            paidDate:      paidDate ? new Date(paidDate) : new Date(),
            status:        "PAGO",
            paymentMethod: paymentMethod || null,
            operationRef:  operationRef  || null,
            receiptUrl:    receiptUrl    || null,
            notes:         `${reservationNumber} — ${eventName}`,
            category:      "SALA_REUNIAO",
            receiptNumber,
          },
        });

        const invoiceNumber  = await nextDocumentNumber(tx, "FT-SALA");
        const invoiceBalance = Math.max(0, finalTotal - finalAmountPaid);

        invoiceRec = await tx.invoice.create({
          data: {
            invoiceNumber,
            companyId:      companyId    || null,
            reservationId:  reservation.id,
            serviceType:    `Sala de Reunião — ${plan.name}`,
            amount:         finalAmount,
            discount:       finalDisc,
            iva:            finalIva,
            totalAmount:    finalTotal,
            amountPaid:     finalAmountPaid,
            balance:        invoiceBalance,
            paidPercentage: finalTotal > 0 ? Math.min(100, (finalAmountPaid / finalTotal) * 100) : 0,
            issueDate:      new Date(),
            dueDate:        start,
            paymentMethod:  paymentMethod || null,
            status:         invoiceStatus,
            notes:          `${reservationNumber} | ${totalHours.toFixed(1)}h | ${participants || 1} participantes`,
          },
        });

        // LiquidationNote
        noteNumber = await nextDocumentNumber(tx, "NL");

        await tx.liquidationNote.create({
          data: {
            noteNumber,
            invoiceId:     invoiceRec.id,
            reservationId: reservation.id,
            companyId:     companyId || null,
            amountBilled:  finalTotal,
            amountPaid:    finalAmountPaid,
            balance:       invoiceBalance,
            paymentMethod: paymentMethod || null,
            operationRef:  operationRef  || null,
            createdBy:     session.name || session.email,
          },
        });

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { paymentId: paymentRec.id, invoiceId: invoiceRec.id, paymentStatus: reservPayStatus },
        });

        // recordFinancialHistory chamado APÓS commit da tx (ver DT-017)
      }

      if (opt === "FACTURAR" && finalTotal > 0) {
        const invoiceNumber = await nextDocumentNumber(tx, "FT-SALA");

        invoiceRec = await tx.invoice.create({
          data: {
            invoiceNumber,
            companyId:     companyId    || null,
            reservationId: reservation.id,
            serviceType:   `Sala de Reunião — ${plan.name}`,
            amount:        finalAmount,
            discount:      finalDisc,
            iva:           finalIva,
            totalAmount:   finalTotal,
            issueDate:     new Date(),
            dueDate:       start,
            status:        "PENDENTE",
            notes:         `${reservationNumber} | ${totalHours.toFixed(1)}h | ${participants || 1} participantes`,
          },
        });

        await tx.reservation.update({ where: { id: reservation.id }, data: { invoiceId: invoiceRec.id } });
      }

      if (opt === "PAGAR_NO_DIA" && finalTotal > 0) {
        const receiptNumber = await nextDocumentNumber(tx, "REC");

        paymentRec = await tx.payment.create({
          data: {
            companyId:     companyId    || null,
            reservationId: reservation.id,
            amount:        finalTotal,
            dueDate:       start,
            status:        "PENDENTE",
            notes:         `${reservationNumber} — Pagamento no dia do evento`,
            category:      "SALA_REUNIAO",
            receiptNumber,
          },
        });

        await tx.reservation.update({ where: { id: reservation.id }, data: { paymentId: paymentRec.id } });
      }

      // Add timeline entry
      await addTimeline(tx, {
        type:          "RESERVA_CRIADA",
        title:         `Reserva criada — ${reservationNumber}`,
        description:   `${plan.name} | ${totalHours.toFixed(1)}h | ${start.toLocaleDateString("pt-PT")}`,
        companyId:     companyId || null,
        referenceId:   reservation.id,
        referenceType: "Reservation",
        createdBy:     session.name || session.email,
      });

      return { reservation, payment: paymentRec, invoice: invoiceRec, noteNumber };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // ── DT-017: recordFinancialHistory APÓS commit (nunca dentro de $transaction) ─
  if (companyId && opt === "PAGAR_AGORA" && result.payment && result.invoice) {
    recordFinancialHistory(prisma, {
      companyId,
      type:        "PAGAMENTO",
      description: `${result.invoice.invoiceNumber} — Sala ${plan?.name} | ${result.reservation.reservationNumber}`,
      amount:      Number(amountPaid) || finalTotal,
      method:      paymentMethod || undefined,
      reference:   result.payment.id,
      createdBy:   session.name || session.email,
    }).catch(err => console.error("[financialHistory] reserva sala:", err));
  }

  // ── Notificações automáticas (não bloqueiam a resposta) ─────────────────────
  notifyReservationCreated({
    clientName:    responsible,
    clientEmail:   email       || "",
    clientWhatsapp: whatsapp   || null,
    eventName,
    planName:      plan?.name  || "",
    startDatetime: start,
    endDatetime:   end,
    totalHours,
    coffeeBreak:   coffeeBreak ?? false,
    totalAmount:   finalTotal,
    reservationId: result.reservation.id,
    status:        reservationStatus,
  }).catch(err => console.error("[notifications] reserva criada:", err));

  // Update lead status if provided (non-fatal)
  if (selectedLeadId) {
    await prisma.roomBookingLead.update({
      where: { id: selectedLeadId },
      data: {
        reservationId: result.reservation.id,
        status:        "RESERVA_CRIADA",
        convertedAt:   new Date(),
        convertedBy:   session.name || session.email,
      },
    }).catch(() => {});
  }

  // Audit: RESERVATION_CREATED — post-commit
  recordAudit({
    actor:     actorFromSession(session),
    action:    "RESERVATION_CREATED",
    entity:    "Reservation",
    entityId:  result.reservation.id,
    entityRef: result.reservation.reservationNumber ?? undefined,
    after: {
      reservationNumber: result.reservation.reservationNumber,
      status:            reservationStatus,
      paymentStatus,
      eventName,
      startDatetime:     start,
      endDatetime:       end,
      totalAmount:       finalTotal,
      planId,
    },
  }).catch(err => console.error("[Audit] RESERVATION_CREATED:", err));

  // Publicar evento de reserva criada → Event Bus notifica todos os módulos
  publish("reservation.created", {
    reservationId:   result.reservation.id,
    reservationNumber: result.reservation.reservationNumber ?? undefined,
    eventName,
    companyId:       companyId || undefined,
    companyName:     companyName || undefined,
    responsible,
    startDatetime:   start,
    endDatetime:     end,
    totalAmount:     finalTotal,
    createdBy:       session.name || session.email,
  }).catch(() => {});

  return NextResponse.json({ ...result, noteNumber: result.noteNumber }, { status: 201 });
}

class ReservationConflictError extends Error {
  constructor() { super("RESERVATION_CONFLICT"); }
}
