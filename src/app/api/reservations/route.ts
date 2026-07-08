import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordFinancialHistory } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const {
    eventName, companyName, companyId, responsible, email, whatsapp,
    planId, participants, startDatetime, endDatetime,
    coffeeBreak, observations, isCustomPricing, customRequest,
    paymentOption, amount, discount, iva, totalAmount,
    paymentMethod, operationRef, receiptUrl, financialNotes,
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

  const conflict = await prisma.reservation.findFirst({
    where: {
      status: { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
      AND: [{ startDatetime: { lt: end } }, { endDatetime: { gt: start } }],
    },
  });
  if (conflict) {
    return NextResponse.json({ error: "Conflito: já existe uma reserva neste período." }, { status: 409 });
  }

  const year  = new Date().getFullYear();
  const count = await prisma.reservation.count({ where: { reservationNumber: { startsWith: `RES-${year}-` } } });
  const reservationNumber = `RES-${year}-${String(count + 1).padStart(6, "0")}`;

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

  const result = await prisma.$transaction(async (tx) => {
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
      },
      include: { plan: true },
    });

    let paymentRec = null;
    let invoiceRec = null;

    if (opt === "PAGAR_AGORA" && finalTotal > 0) {
      const recYear  = new Date().getFullYear();
      const recCount = await tx.payment.count({ where: { receiptNumber: { startsWith: `REC-${recYear}-` } } });
      const receiptNumber = `REC-${recYear}-${String(recCount + 1).padStart(6, "0")}`;

      paymentRec = await tx.payment.create({
        data: {
          companyId:     companyId    || null,
          reservationId: reservation.id,
          amount:        finalTotal,
          dueDate:       start,
          paidDate:      new Date(),
          status:        "PAGO",
          paymentMethod: paymentMethod || null,
          operationRef:  operationRef  || null,
          receiptUrl:    receiptUrl    || null,
          notes:         `${reservationNumber} — ${eventName}`,
          category:      "SALA_REUNIAO",
          receiptNumber,
        },
      });

      const invYear  = new Date().getFullYear();
      const invCount = await tx.invoice.count({ where: { invoiceNumber: { startsWith: `FT-SALA-${invYear}-` } } });
      const invoiceNumber = `FT-SALA-${invYear}-${String(invCount + 1).padStart(6, "0")}`;

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
          paymentMethod: paymentMethod || null,
          status:        "PAGO",
          notes:         `${reservationNumber} | ${totalHours.toFixed(1)}h | ${participants || 1} participantes`,
        },
      });

      await tx.reservation.update({ where: { id: reservation.id }, data: { paymentId: paymentRec.id, invoiceId: invoiceRec.id } });

      if (companyId) {
        await recordFinancialHistory(tx as Parameters<typeof recordFinancialHistory>[0], {
          companyId,
          type:        "PAGAMENTO",
          description: `${invoiceNumber} — Sala ${plan.name} | ${reservationNumber}`,
          amount:      finalTotal,
          method:      paymentMethod || undefined,
          reference:   paymentRec.id,
          createdBy:   session.name || session.email,
        });
      }
    }

    if (opt === "FACTURAR" && finalTotal > 0) {
      const invYear  = new Date().getFullYear();
      const invCount = await tx.invoice.count({ where: { invoiceNumber: { startsWith: `FT-SALA-${invYear}-` } } });
      const invoiceNumber = `FT-SALA-${invYear}-${String(invCount + 1).padStart(6, "0")}`;

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
      const recYear  = new Date().getFullYear();
      const recCount = await tx.payment.count({ where: { receiptNumber: { startsWith: `REC-${recYear}-` } } });
      const receiptNumber = `REC-${recYear}-${String(recCount + 1).padStart(6, "0")}`;

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

    return { reservation, payment: paymentRec, invoice: invoiceRec };
  });

  return NextResponse.json(result, { status: 201 });
}
