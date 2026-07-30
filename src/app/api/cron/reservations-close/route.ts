/**
 * POST /api/cron/reservations-close
 *
 * Cron diário de auto-conclusão de reservas.
 * Executa às 03:00 WAT (UTC 02:00).
 *
 * Comportamento:
 *  1. Busca todas as reservas CONFIRMADA com endDatetime < now
 *  2. Marca cada uma como CONCLUIDA individualmente (para publicar evento por reserva)
 *  3. Publica `reservation.completed` no Event Bus para cada reserva concluída
 *  4. Retorna { closed: number, errors: number, durationMs: number }
 *
 * Segurança: Bearer CRON_SECRET
 *
 * Configuração Vercel (vercel.json):
 *   { "crons": [{ "path": "/api/cron/reservations-close", "schedule": "0 2 * * *" }] }
 *   (UTC 02:00 = Africa/Luanda 03:00)
 *
 * BR-RES-009 — VOL04-2B — 29 Julho 2026
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }   from "@/lib/prisma";
import { publish }  from "@/lib/event-bus";
import "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ── Autenticação do cron ───────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const startedAt = Date.now();
  const now       = new Date();

  // ── Buscar reservas elegíveis para conclusão ───────────────────────────────
  const toClose = await prisma.reservation.findMany({
    where: {
      status:      "CONFIRMADA",
      endDatetime: { lt: now },
    },
    select: {
      id:                true,
      reservationNumber: true,
      eventName:         true,
      companyId:         true,
      endDatetime:       true,
    },
  });

  if (toClose.length === 0) {
    return NextResponse.json({
      closed:     0,
      errors:     0,
      durationMs: Date.now() - startedAt,
      message:    "Sem reservas a concluir.",
    });
  }

  let closed = 0;
  let errors = 0;

  for (const reservation of toClose) {
    try {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data:  { status: "CONCLUIDA" },
      });

      // Publicar evento APÓS persistência (BR-RES-009 + princípio DT-017)
      publish("reservation.completed", {
        reservationId:     reservation.id,
        reservationNumber: reservation.reservationNumber ?? undefined,
        eventName:         reservation.eventName         ?? undefined,
        companyId:         reservation.companyId         ?? undefined,
        endDatetime:       reservation.endDatetime,
      }).catch(err =>
        console.error(`[cron/reservations-close] publish falhou para ${reservation.id}:`, err)
      );

      closed++;
    } catch (err) {
      console.error(
        `[cron/reservations-close] Erro ao concluir reserva ${reservation.id}:`,
        err
      );
      errors++;
    }
  }

  console.log(
    `[cron/reservations-close] ${closed} concluída(s), ${errors} erro(s) — ${Date.now() - startedAt}ms`
  );

  return NextResponse.json({
    closed,
    errors,
    durationMs: Date.now() - startedAt,
  });
}
