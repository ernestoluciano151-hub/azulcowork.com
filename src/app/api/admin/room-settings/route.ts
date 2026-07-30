/**
 * /api/admin/room-settings
 *
 * GET — obter configurações globais das salas (ADMIN)
 * PUT — actualizar configurações (ADMIN)
 *
 * VOL04-3B: validação de openTime/closeTime, minHours, maxHours, maxDiscount
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { validateRoomSettings } from "@/lib/plan-validators";

export const dynamic = "force-dynamic";

async function getOrCreate() {
  let s = await prisma.roomSettings.findFirst();
  if (!s) {
    s = await prisma.roomSettings.create({
      data: { id: "default" },
    });
  }
  return s;
}

export async function GET() {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;
  const settings = await getOrCreate();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const body = await req.json();

  // ── Validação ──────────────────────────────────────────────────────────────
  const validationErr = validateRoomSettings(body);
  if (validationErr) return NextResponse.json(validationErr, { status: 400 });

  const settings = await getOrCreate();

  const updated = await prisma.roomSettings.update({
    where: { id: settings.id },
    data: {
      defaultPricePerHour: body.defaultPricePerHour !== undefined ? Number(body.defaultPricePerHour) : undefined,
      defaultHalfDay:      body.defaultHalfDay      !== undefined ? Number(body.defaultHalfDay)      : undefined,
      defaultFullDay:      body.defaultFullDay       !== undefined ? Number(body.defaultFullDay)      : undefined,
      defaultWeekend:      body.defaultWeekend       !== undefined ? Number(body.defaultWeekend)      : undefined,
      defaultIva:          body.defaultIva           !== undefined ? Number(body.defaultIva)          : undefined,
      maxDiscount:         body.maxDiscount          !== undefined ? Number(body.maxDiscount)          : undefined,
      currency:            body.currency             ?? undefined,
      openTime:            body.openTime             ?? undefined,
      closeTime:           body.closeTime            ?? undefined,
      minHours:            body.minHours             !== undefined ? Number(body.minHours)             : undefined,
      maxHours:            body.maxHours             !== undefined ? Number(body.maxHours)             : undefined,
      updatedBy:           session.name || session.email,
    },
  });

  return NextResponse.json({ settings: updated });
}
