/**
 * GET  /api/portal/bookings  — lista reservas da empresa autenticada
 * POST /api/portal/bookings  — criar nova reserva (PORTAL_MEMBER ou superior)
 *
 * Reservas usam o modelo Reservation existente (salas de reunião).
 * Isolamento: companyId obrigatório.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession, requirePortalRole } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";
import { PortalRole } from "@prisma/client";
import { z } from "zod";
import { calcPrice } from "@/lib/pricing-service";

const VALID_STATUSES = ["CONFIRMADA","RESERVADO","PENDENTE_APROVACAO","CANCELADA","CONCLUIDA"] as const;

// ── GET — lista reservas ───────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const from   = searchParams.get("from"); // ISO date
    const to     = searchParams.get("to");   // ISO date

    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      companyId: user.companyId,  // isolamento multi-tenant
    };
    if (status) where.status = status;
    if (from || to) {
      where.startDatetime = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }

    const bookings = await prisma.reservation.findMany({
      where,
      orderBy: { startDatetime: "desc" },
      take:    50,
      select: {
        id:                true,
        reservationNumber: true,
        eventName:         true,
        status:            true,
        startDatetime:     true,
        endDatetime:       true,
        totalHours:        true,
        participants:      true,
        coffeeBreak:       true,
        paymentStatus:     true,
        totalAmount:       true,
        plan: {
          select: { id: true, name: true, maxPeople: true },
        },
      },
    });

    return NextResponse.json({ data: bookings });
  } catch (err) {
    console.error("[GET /api/portal/bookings]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}

// ── POST — criar reserva ───────────────────────────────────────────────────────

const createSchema = z.object({
  planId:       z.string().cuid("ID de sala inválido."),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)."),
  startTime:    z.string().regex(/^\d{2}:\d{2}$/, "Hora de início inválida (HH:MM)."),
  endTime:      z.string().regex(/^\d{2}:\d{2}$/, "Hora de fim inválida (HH:MM)."),
  eventName:    z.string().min(3).max(120),
  participants: z.number().int().min(1).max(100),
  coffeeBreak:  z.boolean().optional().default(false),
  notes:        z.string().max(500).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_MEMBER);
    if (error) return error;

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const { planId, date, startTime, endTime, eventName, participants, coffeeBreak, notes } = parsed.data;

    // Verificar que o plano existe e está activo
    const plan = await prisma.meetingPlan.findFirst({
      where: { id: planId, active: true },
    });
    if (!plan) {
      return NextResponse.json({ error: "Sala ou plano não encontrado." }, { status: 404 });
    }

    // Verificar capacidade
    if (participants > plan.maxPeople) {
      return NextResponse.json(
        { error: `A sala ${plan.name} tem capacidade máxima de ${plan.maxPeople} pessoas.` },
        { status: 400 }
      );
    }

    // Construir datetimes
    const startDatetime = new Date(`${date}T${startTime}:00`);
    const endDatetime   = new Date(`${date}T${endTime}:00`);

    if (endDatetime <= startDatetime) {
      return NextResponse.json(
        { error: "A hora de fim deve ser posterior à hora de início." },
        { status: 400 }
      );
    }

    // Verificar que é no futuro (min 1h de antecedência)
    const minAdvance = new Date(Date.now() + 60 * 60 * 1000);
    if (startDatetime < minAdvance) {
      return NextResponse.json(
        { error: "A reserva deve ser feita com pelo menos 1 hora de antecedência." },
        { status: 400 }
      );
    }

    // Verificar conflito de horário
    const conflict = await prisma.reservation.findFirst({
      where: {
        planId,
        status:    { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
        AND: [
          { startDatetime: { lt: endDatetime } },
          { endDatetime:   { gt: startDatetime } },
        ],
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Este horário já está reservado. Por favor escolha outro horário." },
        { status: 409 }
      );
    }

    // Calcular horas e valor — usa o mesmo motor de preços do painel admin
    // (calcPrice/roundBillableHours em src/lib/pricing-service.ts), SSoT único
    // do cálculo. Antes desta correcção esta rota calculava
    // `totalHours * pricePerHour` directamente (horas fraccionadas, sem a
    // regra de arredondamento de 30 min, e sem fallback para os 15.000 Kz/h
    // por defeito quando o plano tinha pricePerHour=0) — divergia do valor
    // mostrado/cobrado nas reservas criadas pelo admin.
    const totalMinutes = Math.round((endDatetime.getTime() - startDatetime.getTime()) / 60000);
    const totalHours   = totalMinutes / 60;
    const pricing = calcPrice({
      plan: {
        pricePerHour:     plan.pricePerHour,
        halfDayPrice:     plan.halfDayPrice,
        fullDayPrice:     plan.fullDayPrice,
        weekendPrice:     plan.weekendPrice,
        coffeeBreakPrice: plan.coffeeBreakPrice,
      },
      totalHours,
      totalMinutes,
      coffeeBreak,
      discount:   0,
      ivaPercent: 0,
      startDate:  startDatetime,
    });
    const baseAmount  = pricing.baseAmount;
    const totalAmount = pricing.totalAmount;

    // Buscar dados da empresa para a reserva
    const company = await prisma.company.findUnique({
      where:  { id: user.companyId },
      select: { name: true, responsible: true, email: true, whatsapp: true },
    });

    const booking = await prisma.reservation.create({
      data: {
        eventName,
        companyId:    user.companyId,
        companyName:  company?.name,
        responsible:  company?.responsible ?? user.name,
        email:        company?.email,
        whatsapp:     company?.whatsapp,
        planId,
        participants,
        startDatetime,
        endDatetime,
        totalHours,
        coffeeBreak:  coffeeBreak ?? false,
        observations: notes,
        status:       "PENDENTE_APROVACAO",  // admin confirma manualmente
        paymentOption:"FACTURAR",
        amount:       baseAmount,
        totalAmount,
        isCustomPricing: false,
      },
      select: {
        id:                true,
        reservationNumber: true,
        eventName:         true,
        status:            true,
        startDatetime:     true,
        endDatetime:       true,
        totalHours:        true,
        participants:      true,
        totalAmount:       true,
        plan: { select: { name: true } },
      },
    });

    return NextResponse.json({ ok: true, data: booking }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/portal/bookings]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
