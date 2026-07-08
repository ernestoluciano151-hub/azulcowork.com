import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: {
      plan:    true,
      company: { select: { id: true, name: true, nif: true, email: true, whatsapp: true } },
    },
  });
  if (!reservation) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  return NextResponse.json({ reservation });
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
