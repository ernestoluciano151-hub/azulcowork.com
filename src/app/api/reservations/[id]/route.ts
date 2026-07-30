import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole, Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { notifyReservationConfirmed } from "@/lib/notifications";
import { publish } from "@/lib/event-bus";
import {
  canTransition,
  isCancellationFree,
  InvalidStatusTransitionError,
} from "@/lib/reservation-state-machine";
import "@/lib/bootstrap";
import { recordAudit, actorFromSession } from "@/lib/audit-service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO);
  if (error) return error;

  const [reservation, invoice, payments, liquidationNotes] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id: params.id },
      include: {
        plan:    true,
        company: { select: { id: true, name: true, nif: true, email: true, whatsapp: true } },
      },
    }),
    prisma.invoice.findFirst({
      where: { reservationId: params.id },
      include: {
        invoicePayments: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.payment.findMany({
      where: { reservationId: params.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.liquidationNote.findMany({
      where: { reservationId: params.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!reservation) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  return NextResponse.json({
    reservation,
    invoice:          invoice ? {
      ...invoice,
      issueDate:       invoice.issueDate.toISOString(),
      dueDate:         invoice.dueDate.toISOString(),
      createdAt:       invoice.createdAt.toISOString(),
      updatedAt:       invoice.updatedAt.toISOString(),
      invoicePayments: invoice.invoicePayments.map(p => ({ ...p, paidDate: p.paidDate?.toISOString() ?? null, createdAt: p.createdAt.toISOString() })),
    } : null,
    payments:         payments.map(p => ({
      ...p,
      dueDate:   p.dueDate.toISOString(),
      paidDate:  p.paidDate?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    liquidationNotes: liquidationNotes.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const body = await req.json();

  // ── 1. Validar transição de status via state machine ────────────────────────
  if (body.status !== undefined) {
    const current = await prisma.reservation.findUnique({
      where:  { id: params.id },
      select: { status: true, startDatetime: true },
    });
    if (!current) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

    if (!canTransition(current.status, body.status)) {
      return NextResponse.json(
        { error: `Transição de estado inválida: ${current.status} → ${body.status}` },
        { status: 422 }
      );
    }

    // Política de cancelamento: calcular elegibilidade de reembolso
    if (body.status === "CANCELADA") {
      body._refundable       = isCancellationFree(current.startDatetime);
      body._hoursUntilEvent  = Math.round(
        (current.startDatetime.getTime() - Date.now()) / (1000 * 60 * 60)
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  const fields = [
    "eventName","companyName","companyId","responsible","email","whatsapp",
    "participants","observations","coffeeBreak","status","isCustomPricing",
    "customRequest","paymentOption","amount","discount","iva","totalAmount",
    "paymentStatus","paymentMethod","operationRef","receiptUrl","financialNotes",
    "cancellationReason",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  // ── 2. Fix DT-013: conflict check em $transaction serializable ──────────────
  let reservation: Awaited<ReturnType<typeof prisma.reservation.update>>;

  const changingDatetime = body.startDatetime !== undefined || body.endDatetime !== undefined;

  if (changingDatetime) {
    const newStart = body.startDatetime ? new Date(body.startDatetime) : undefined;
    const newEnd   = body.endDatetime   ? new Date(body.endDatetime)   : undefined;

    try {
      reservation = await prisma.$transaction(async (tx) => {
        const existing = await tx.reservation.findUnique({ where: { id: params.id } });
        if (!existing) throw new NotFoundError();

        const s = newStart || existing.startDatetime;
        const e = newEnd   || existing.endDatetime;

        if (e <= s) throw new InvalidDateRangeError();

        // Conflict check DENTRO da transacção (elimina janela TOCTOU)
        const conflict = await tx.reservation.findFirst({
          where: {
            status: { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
            id:     { not: params.id },
            AND:    [{ startDatetime: { lt: e } }, { endDatetime: { gt: s } }],
          },
        });
        if (conflict) throw new ReservationConflictError();

        return tx.reservation.update({
          where: { id: params.id },
          data:  {
            ...data,
            startDatetime: s,
            endDatetime:   e,
            totalHours:    (e.getTime() - s.getTime()) / 3600000,
          },
          include: { plan: true, company: { select: { id: true, name: true } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
      }
      if (err instanceof InvalidDateRangeError) {
        return NextResponse.json({ error: "A hora de fim deve ser posterior à hora de início." }, { status: 400 });
      }
      if (err instanceof ReservationConflictError) {
        return NextResponse.json({ error: "Conflito com outra reserva neste período." }, { status: 409 });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
        return NextResponse.json({ error: "Conflito de concorrência. Tente novamente." }, { status: 409 });
      }
      throw err;
    }
  } else {
    // Sem alteração de horário — update directo
    const exists = await prisma.reservation.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

    reservation = await prisma.reservation.update({
      where: { id: params.id },
      data,
      include: { plan: true, company: { select: { id: true, name: true } } },
    });
  }

  // Audit: RESERVATION_STATUS_CHANGED ou RESERVATION_UPDATED — post-commit
  if (body.status !== undefined) {
    recordAudit({
      actor:     actorFromSession(session),
      action:    "RESERVATION_STATUS_CHANGED",
      entity:    "Reservation",
      entityId:  reservation.id,
      entityRef: reservation.reservationNumber ?? undefined,
      ipAddress: ip,
      after: {
        status:             reservation.status,
        paymentStatus:      reservation.paymentStatus,
        cancellationReason: body.cancellationReason ?? null,
      },
    }).catch(err => console.error("[Audit] RESERVATION_STATUS_CHANGED:", err));
  } else if (Object.keys(data).length > 0) {
    recordAudit({
      actor:     actorFromSession(session),
      action:    "RESERVATION_UPDATED",
      entity:    "Reservation",
      entityId:  reservation.id,
      entityRef: reservation.reservationNumber ?? undefined,
      ipAddress: ip,
      after: { status: reservation.status, totalAmount: reservation.totalAmount },
    }).catch(err => console.error("[Audit] RESERVATION_UPDATED:", err));
  }

  // ── Priority #5: regenerar invoice quando valores financeiros mudam ────────
  const financialChanged = ["totalAmount","amount","discount","iva"].some(f => body[f] !== undefined);
  if (financialChanged && reservation.totalAmount > 0) {
    const existingInvoice = await prisma.invoice.findFirst({ where: { reservationId: params.id } });
    if (existingInvoice) {
      const newBalance = Math.max(0, reservation.totalAmount - (existingInvoice.amountPaid || 0));
      const pct        = reservation.totalAmount > 0
        ? Math.min(100, ((existingInvoice.amountPaid || 0) / reservation.totalAmount) * 100)
        : 100;
      const newStatus  = newBalance <= 0 ? "LIQUIDADA" : existingInvoice.amountPaid > 0 ? "PARCIAL" : existingInvoice.status;
      await prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          amount:          reservation.amount         || reservation.totalAmount,
          totalAmount:     reservation.totalAmount,
          balance:         newBalance,
          paidPercentage:  pct,
          status:          newStatus,
          // Update pricing metadata for sala invoices
          serviceType:     existingInvoice.serviceType || "Salas de Reunião",
          notes:           body.financialNotes         || existingInvoice.notes,
        },
      });
    }
  }

  // ── Notificação e evento quando status muda para CONFIRMADA ─────────────────
  if (body.status === "CONFIRMADA" && reservation.email) {
    const existingInvoice = await prisma.invoice.findFirst({
      where: { reservationId: params.id },
      select: { invoiceNumber: true },
    });
    notifyReservationConfirmed({
      clientName:    reservation.responsible || "Cliente",
      clientEmail:   reservation.email,
      eventName:     reservation.eventName   || "Evento",
      planName:      reservation.plan?.name  || "",
      startDatetime: reservation.startDatetime,
      endDatetime:   reservation.endDatetime,
      totalHours:    reservation.totalHours,
      coffeeBreak:   reservation.coffeeBreak,
      totalAmount:   reservation.totalAmount,
      reservationId: reservation.id,
      invoiceNumber: existingInvoice?.invoiceNumber ?? null,
    }).catch(err => console.error("[notifications] confirmação:", err));

    publish("reservation.confirmed", {
      reservationId:     reservation.id,
      reservationNumber: reservation.reservationNumber ?? undefined,
      eventName:         reservation.eventName,
      companyId:         reservation.companyId ?? undefined,
      responsible:       reservation.responsible,
      startDatetime:     reservation.startDatetime,
    }).catch(() => {});
  }

  // ── Evento quando status muda para CANCELADA ─────────────────────────────────
  if (body.status === "CANCELADA") {
    publish("reservation.cancelled", {
      reservationId:     reservation.id,
      reservationNumber: reservation.reservationNumber ?? undefined,
      eventName:         reservation.eventName,
      companyId:         reservation.companyId ?? undefined,
      cancellationReason: body.cancellationReason ?? undefined,
      refundable:        body._refundable ?? false,
    }).catch(() => {});
  }

  const response: Record<string, unknown> = { reservation };
  if (body.status === "CANCELADA") {
    response.refundable      = body._refundable       ?? false;
    response.hoursUntilEvent = body._hoursUntilEvent  ?? 0;
    response.policy          = body._refundable ? "FREE" : "NO_REFUND";
  }

  return NextResponse.json(response);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const reservation = await prisma.reservation.findUnique({
    where:  { id: params.id },
    select: { eventName: true, reservationNumber: true, startDatetime: true },
  });
  if (!reservation) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  await prisma.reservation.update({
    where: { id: params.id },
    data:  { status: "CANCELADA" },
  });

  publish("reservation.cancelled", {
    reservationId:     params.id,
    reservationNumber: reservation.reservationNumber ?? undefined,
    eventName:         reservation.eventName ?? "Evento",
    refundable:        isCancellationFree(reservation.startDatetime),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

// ── Erros internos ─────────────────────────────────────────────────────────────

class NotFoundError extends Error {
  constructor() { super("NOT_FOUND"); }
}

class InvalidDateRangeError extends Error {
  constructor() { super("INVALID_DATE_RANGE"); }
}

class ReservationConflictError extends Error {
  constructor() { super("RESERVATION_CONFLICT"); }
}

// Re-export para uso em testes
export { InvalidStatusTransitionError };
