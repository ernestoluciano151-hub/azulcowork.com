import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const data: any = {};

  if (body.eventName !== undefined) data.eventName = body.eventName;
  if (body.companyName !== undefined) data.companyName = body.companyName;
  if (body.responsible !== undefined) data.responsible = body.responsible;
  if (body.participants !== undefined) data.participants = Number(body.participants);
  if (body.observations !== undefined) data.observations = body.observations;
  if (body.coffeeBreak !== undefined) data.coffeeBreak = body.coffeeBreak;
  if (body.status !== undefined) data.status = body.status;
  if (body.isCustomPricing !== undefined) data.isCustomPricing = body.isCustomPricing;
  if (body.customRequest !== undefined) data.customRequest = body.customRequest;

  if (body.startDatetime !== undefined) data.startDatetime = new Date(body.startDatetime);
  if (body.endDatetime !== undefined) data.endDatetime = new Date(body.endDatetime);

  // If changing time, recalculate totalHours and check conflicts
  if (body.startDatetime || body.endDatetime) {
    const existing = await prisma.reservation.findUnique({ where: { id: params.id } });
    if (existing) {
      const start = data.startDatetime || existing.startDatetime;
      const end = data.endDatetime || existing.endDatetime;
      data.totalHours = (end.getTime() - start.getTime()) / 3600000;

      const conflict = await prisma.reservation.findFirst({
        where: {
          status: { in: ["CONFIRMADA", "PENDENTE_APROVACAO"] },
          id: { not: params.id },
          AND: [
            { startDatetime: { lt: end } },
            { endDatetime: { gt: start } }
          ]
        }
      });
      if (conflict) {
        return NextResponse.json({ error: "Conflito com outra reserva existente." }, { status: 409 });
      }
    }
  }

  const reservation = await prisma.reservation.update({
    where: { id: params.id },
    data,
    include: { plan: true }
  });

  return NextResponse.json({ reservation });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  // Soft cancel
  await prisma.reservation.update({
    where: { id: params.id },
    data: { status: "CANCELADA" }
  });

  return NextResponse.json({ ok: true });
}
