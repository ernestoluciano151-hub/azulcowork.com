import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const where: any = {};
  if (status) where.status = status;
  if (from || to) {
    where.startDatetime = {};
    if (from) where.startDatetime.gte = new Date(from);
    if (to) where.startDatetime.lte = new Date(to);
  }

  const [reservations, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: { startDatetime: "asc" },
      include: { plan: true },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.reservation.count({ where })
  ]);

  return NextResponse.json({ reservations, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const {
    eventName, companyName, responsible, planId,
    participants, startDatetime, endDatetime,
    coffeeBreak, observations, isCustomPricing, customRequest
  } = body;

  if (!eventName || !responsible || !planId || !startDatetime || !endDatetime) {
    return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
  }

  const start = new Date(startDatetime);
  const end = new Date(endDatetime);

  if (end <= start) {
    return NextResponse.json({ error: "A hora de fim deve ser posterior à hora de início." }, { status: 400 });
  }

  const totalHours = (end.getTime() - start.getTime()) / 3600000;

  // Validate plan exists
  const plan = await prisma.meetingPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  }

  // For Personalizado plan requiring custom pricing, validate min hours
  if (isCustomPricing && plan.customPricingAllowed && plan.minHoursForCustom) {
    if (totalHours < plan.minHoursForCustom) {
      return NextResponse.json({
        error: `O plano Personalizado requer no mínimo ${plan.minHoursForCustom} horas.`
      }, { status: 400 });
    }
  }

  // Conflict detection
  const conflict = await prisma.reservation.findFirst({
    where: {
      status: { in: ["CONFIRMADA", "PENDENTE_APROVACAO"] },
      AND: [
        { startDatetime: { lt: end } },
        { endDatetime: { gt: start } }
      ]
    }
  });

  if (conflict) {
    return NextResponse.json({
      error: "Conflito: já existe uma reserva para este período."
    }, { status: 409 });
  }

  // Set status based on custom pricing
  const reservationStatus = isCustomPricing ? "PENDENTE_APROVACAO" : "CONFIRMADA";

  const reservation = await prisma.reservation.create({
    data: {
      eventName,
      companyName: companyName || null,
      responsible,
      planId,
      participants: Number(participants) || 1,
      startDatetime: start,
      endDatetime: end,
      totalHours,
      coffeeBreak: coffeeBreak ?? false,
      observations: observations || null,
      status: reservationStatus,
      isCustomPricing: isCustomPricing ?? false,
      customRequest: customRequest || null
    },
    include: { plan: true }
  });

  return NextResponse.json({ reservation }, { status: 201 });
}
