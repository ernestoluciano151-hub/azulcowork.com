/**
 * GET /api/reservations/availability
 *
 * Disponibilidade de salas — painel admin.
 * Diferença do portal: expõe `eventName` nos slots ocupados.
 *
 * Query params:
 *   date   — YYYY-MM-DD (obrigatório)
 *   planId — ID do plano/sala (opcional; se omitido, retorna todas as salas activas)
 *
 * Resposta:
 *   {
 *     date: string;
 *     plans: Array<{
 *       id, name, maxPeople, openTime, closeTime,
 *       bookedSlots: [{ from, to, status, eventName }],
 *       freeSlots:   [{ from, to }]
 *     }>
 *   }
 *
 * VOL04-2A — 29 Julho 2026
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const OCCUPIED_STATUSES = ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] as const;

// ── Helpers de tempo ──────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h   = Math.floor(m / 60);
  const min = m % 60;
  return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}

/**
 * Calcula os slots livres entre slots ocupados, dentro do horário de funcionamento.
 * Exportado para facilitar testes unitários.
 */
export function computeFreeSlots(
  openTime:    string,
  closeTime:   string,
  date:        string,
  bookedSlots: Array<{ from: Date; to: Date }>
): Array<{ from: string; to: string }> {
  const openMin  = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  const midnight = new Date(`${date}T00:00:00.000Z`).getTime();

  const sorted = [...bookedSlots]
    .map(s => ({
      startMin: Math.round((s.from.getTime() - midnight) / 60000),
      endMin:   Math.round((s.to.getTime()   - midnight) / 60000),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  const free: Array<{ from: string; to: string }> = [];
  let cursor = openMin;

  for (const slot of sorted) {
    const sMin = Math.max(slot.startMin, openMin);
    const eMin = Math.min(slot.endMin,   closeMin);
    if (cursor < sMin) {
      free.push({ from: minutesToTime(cursor), to: minutesToTime(sMin) });
    }
    if (eMin > cursor) cursor = eMin;
  }

  if (cursor < closeMin) {
    free.push({ from: minutesToTime(cursor), to: minutesToTime(closeMin) });
  }

  return free;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { error } = await requireRole(
    AdminRole.ADMIN,
    AdminRole.COMERCIAL,
    AdminRole.FINANCEIRO
  );
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const date   = searchParams.get("date");
  const planId = searchParams.get("planId");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Parâmetro 'date' é obrigatório no formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd   = new Date(`${date}T23:59:59.999Z`);

  // ── Carregar settings e planos em paralelo ───────────────────────────────────
  const [settings, plans] = await Promise.all([
    prisma.roomSettings.findFirst(),
    prisma.meetingPlan.findMany({
      where:   { active: true, ...(planId ? { id: planId } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, maxPeople: true },
    }),
  ]);

  if (planId && plans.length === 0) {
    return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
  }

  const openTime  = settings?.openTime  ?? "08:00";
  const closeTime = settings?.closeTime ?? "18:00";
  const planIds   = plans.map(p => p.id);

  // ── Reservas do dia para estas salas ─────────────────────────────────────────
  const reservations = await prisma.reservation.findMany({
    where: {
      planId: { in: planIds },
      status: { in: [...OCCUPIED_STATUSES] },
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
      eventName:     true,   // admin vê o nome do evento
    },
  });

  // ── Agrupar por planId ────────────────────────────────────────────────────────
  type BookedSlot = {
    from:      string;
    to:        string;
    status:    string;
    eventName: string | null;
  };

  const slotsByPlan: Record<string, Array<BookedSlot & { _from: Date; _to: Date }>> = {};
  for (const r of reservations) {
    if (!slotsByPlan[r.planId]) slotsByPlan[r.planId] = [];
    slotsByPlan[r.planId].push({
      from:      r.startDatetime.toISOString(),
      to:        r.endDatetime.toISOString(),
      status:    r.status,
      eventName: r.eventName,
      _from:     r.startDatetime,
      _to:       r.endDatetime,
    });
  }

  // ── Montar resposta ───────────────────────────────────────────────────────────
  const result = plans.map(plan => {
    const raw = slotsByPlan[plan.id] ?? [];

    const bookedSlots: BookedSlot[] = raw.map(({ _from: _f, _to: _t, ...rest }) => rest);

    const freeSlots = computeFreeSlots(
      openTime,
      closeTime,
      date,
      raw.map(s => ({ from: s._from, to: s._to }))
    );

    return {
      id:          plan.id,
      name:        plan.name,
      maxPeople:   plan.maxPeople,
      openTime,
      closeTime,
      bookedSlots,
      freeSlots,
    };
  });

  return NextResponse.json({ date, plans: result });
}
