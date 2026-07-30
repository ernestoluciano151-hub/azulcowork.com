/**
 * GET /api/portal/rooms/availability
 *
 * Retorna salas activas e os slots ocupados numa determinada data.
 * Query params:
 *   date    — YYYY-MM-DD (obrigatório)
 *   roomId  — ID do plano (opcional; se omitido, retorna todas as salas)
 *
 * Resposta:
 *   rooms: [{
 *     id, name, maxPeople, pricePerHour, coffeeBreakPrice, amenities,
 *     bookedSlots: [{ from, to, status }]  // slots ocupados nesse dia
 *   }]
 *
 * Qualquer role autenticado pode consultar disponibilidade.
 * Nota: não expõe companyId dos reservantes (privacidade).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";

const OCCUPIED_STATUSES = ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    // Suprimir aviso de unused var — user é necessário para a verificação de sessão
    void user;

    const { searchParams } = req.nextUrl;
    const date   = searchParams.get("date");   // YYYY-MM-DD
    const roomId = searchParams.get("roomId"); // opcional

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Parâmetro 'date' é obrigatório no formato YYYY-MM-DD." },
        { status: 400 }
      );
    }

    // Início e fim do dia na timezone UTC (servidor)
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd   = new Date(`${date}T23:59:59.999Z`);

    // Buscar planos activos
    const planWhere = {
      active: true,
      ...(roomId ? { id: roomId } : {}),
    };

    const plans = await prisma.meetingPlan.findMany({
      where:   planWhere,
      orderBy: { name: "asc" },
      select: {
        id:              true,
        name:            true,
        maxPeople:       true,
        pricePerHour:    true,
        coffeeBreakPrice:true,
        description:     true,
      },
    });

    if (plans.length === 0 && roomId) {
      return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
    }

    // Buscar reservas do dia para as salas pedidas
    const planIds = plans.map(p => p.id);

    const reservations = await prisma.reservation.findMany({
      where: {
        planId:    { in: planIds },
        status:    { in: [...OCCUPIED_STATUSES] },
        AND: [
          { startDatetime: { lt: dayEnd   } },
          { endDatetime:   { gt: dayStart } },
        ],
      },
      select: {
        planId:        true,
        startDatetime: true,
        endDatetime:   true,
        status:        true,
        // NÃO expor companyId ou companyName (privacidade entre clientes)
      },
    });

    // Agrupar slots por planId
    const slotsByPlan: Record<string, Array<{ from: string; to: string; status: string }>> = {};
    for (const r of reservations) {
      if (!slotsByPlan[r.planId]) slotsByPlan[r.planId] = [];
      slotsByPlan[r.planId].push({
        from:   r.startDatetime.toISOString(),
        to:     r.endDatetime.toISOString(),
        status: r.status,
      });
    }

    const rooms = plans.map(plan => ({
      ...plan,
      bookedSlots: slotsByPlan[plan.id] ?? [],
    }));

    return NextResponse.json({ data: rooms, date });
  } catch (err) {
    console.error("[GET /api/portal/rooms/availability]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
