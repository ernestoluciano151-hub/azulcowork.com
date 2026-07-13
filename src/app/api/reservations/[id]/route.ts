import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notifyReservationConfirmed } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  const fields = [
    "eventName","companyName","companyId","responsible","email","whatsapp",
    "participants","observations","coffeeBreak","status","isCustomPricing",
    "customRequest","paymentOption","amount","discount","iva","totalAmount",
    "paymentStatus","paymentMethod","operationRef","receiptUrl","financialNotes",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  if (body.startDatetime !== undefined) data.startDatetime = new Date(body.startDatetime);
  if (body.endDatetime   !== undefined) data.endDatetime   = new Date(body.endDatetime);

  if (body.startDatetime || body.endDatetime) {
    const existing = await prisma.reservation.findUnique({ where: { id: params.id } });
    if (existing) {
      const s = data.startDatetime || existing.startDatetime;
      const e = data.endDatetime   || existing.endDatetime;
      data.totalHours = (e.getTime() - s.getTime()) / 3600000;

      const conflict = await prisma.reservation.findFirst({
        where: {
          status: { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
          id: { not: params.id },
          AND: [{ startDatetime: { lt: e } }, { endDatetime: { gt: s } }],
        },
      });
      if (conflict) return NextResponse.json({ error: "Conflito com outra reserva." }, { status: 409 });
    }
  }

  const reservation = await prisma.reservation.update({
    where: { id: params.id },
    data,
    include: { plan: true, company: { select: { id: true, name: true } } },
  });

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

  // ── Notificação quando status muda para CONFIRMADA ──────────────────────────
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
  }

  return NextResponse.json({ reservation });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  await prisma.reservation.update({
    where: { id: params.id },
    data:  { status: "CANCELADA" },
  });

  return NextResponse.json({ ok: true });
}
