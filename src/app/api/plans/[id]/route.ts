/**
 * /api/plans/[id]
 *
 * PATCH  — editar plano (ADMIN)
 * DELETE — desactivar plano — soft-delete (ADMIN)
 *
 * VOL04-3A:
 *  - Validação de preços não negativos (PATCH)
 *  - Verificação de reservas futuras antes de desactivar (PATCH active:false + DELETE)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { validatePlanPrices, validateMaxPeople } from "@/lib/plan-validators";

export const dynamic = "force-dynamic";

// ── Verificar se o plano tem reservas futuras activas ─────────────────────────
async function hasFutureReservations(planId: string): Promise<boolean> {
  const count = await prisma.reservation.count({
    where: {
      planId,
      status:        { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
      startDatetime: { gt: new Date() },
    },
  });
  return count > 0;
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  // Verificar existência
  const existing = await prisma.meetingPlan.findUnique({
    where:  { id: params.id },
    select: { id: true, active: true },
  });
  if (!existing) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  const body = await req.json();

  // ── Validação de maxPeople se fornecido ──────────────────────────────────────
  if (body.maxPeople !== undefined) {
    const maxPeopleErr = validateMaxPeople(body.maxPeople);
    if (maxPeopleErr) return NextResponse.json(maxPeopleErr, { status: 400 });
  }

  // ── Validação de preços ───────────────────────────────────────────────────────
  const priceErr = validatePlanPrices(body);
  if (priceErr) return NextResponse.json(priceErr, { status: 400 });

  // ── Protecção: não desactivar plano com reservas futuras ─────────────────────
  const isDeactivating = body.active === false && existing.active !== false;
  if (isDeactivating) {
    const hasFuture = await hasFutureReservations(params.id);
    if (hasFuture) {
      return NextResponse.json(
        { error: "Não é possível desactivar um plano com reservas futuras pendentes." },
        { status: 409 }
      );
    }
  }

  // ── Montar dados ──────────────────────────────────────────────────────────────
  const data: Record<string, unknown> = {};
  const numberFields = ["maxPeople","pricePerHour","coffeeBreakPrice","halfDayPrice","fullDayPrice","weekendPrice","promoPrice","minHoursForCustom"];
  const boolFields   = ["coffeeBreakAvailable","customPricingAllowed","active"];
  const strFields    = ["name","description"];

  for (const f of strFields)    if (body[f] !== undefined) data[f] = String(body[f]).trim();
  for (const f of numberFields) if (body[f] !== undefined) data[f] = Number(body[f]);
  for (const f of boolFields)   if (body[f] !== undefined) data[f] = Boolean(body[f]);

  const plan = await prisma.meetingPlan.update({ where: { id: params.id }, data });
  return NextResponse.json({ plan });
}

// ── DELETE (soft-delete) ──────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  // Verificar existência
  const existing = await prisma.meetingPlan.findUnique({
    where:  { id: params.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  // Protecção: não desactivar plano com reservas futuras
  const hasFuture = await hasFutureReservations(params.id);
  if (hasFuture) {
    return NextResponse.json(
      { error: "Não é possível desactivar um plano com reservas futuras pendentes." },
      { status: 409 }
    );
  }

  await prisma.meetingPlan.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
