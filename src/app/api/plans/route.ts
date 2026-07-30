/**
 * /api/plans
 *
 * GET  — listar planos activos (ADMIN | COMERCIAL | FINANCEIRO)
 * POST — criar novo plano (ADMIN)
 *
 * VOL04-3A: validação inline de preços e capacidade
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { validatePlanPrices, validateMaxPeople } from "@/lib/plan-validators";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO);
  if (error) return error;

  const plans = await prisma.meetingPlan.findMany({
    where:   { active: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const body = await req.json();
  const { name, maxPeople, description, coffeeBreakAvailable, customPricingAllowed, minHoursForCustom } = body;

  // ── Campos obrigatórios ─────────────────────────────────────────────────────
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nome do plano é obrigatório." }, { status: 400 });
  }

  const maxPeopleErr = validateMaxPeople(maxPeople);
  if (maxPeopleErr) return NextResponse.json(maxPeopleErr, { status: 400 });

  // ── Validação de preços (sem valores negativos) ─────────────────────────────
  const priceErr = validatePlanPrices(body);
  if (priceErr) return NextResponse.json(priceErr, { status: 400 });

  const plan = await prisma.meetingPlan.create({
    data: {
      name:                 name.trim(),
      maxPeople:            Number(maxPeople),
      description:          description          || null,
      coffeeBreakAvailable: coffeeBreakAvailable ?? true,
      customPricingAllowed: customPricingAllowed ?? false,
      minHoursForCustom:    minHoursForCustom ? Number(minHoursForCustom) : 16,
      pricePerHour:         body.pricePerHour     !== undefined ? Number(body.pricePerHour)     : 0,
      coffeeBreakPrice:     body.coffeeBreakPrice !== undefined ? Number(body.coffeeBreakPrice) : 0,
      halfDayPrice:         body.halfDayPrice     !== undefined ? Number(body.halfDayPrice)     : 0,
      fullDayPrice:         body.fullDayPrice     !== undefined ? Number(body.fullDayPrice)     : 0,
      weekendPrice:         body.weekendPrice     !== undefined ? Number(body.weekendPrice)     : 0,
      promoPrice:           body.promoPrice       !== undefined ? Number(body.promoPrice)       : 0,
    },
  });

  return NextResponse.json({ plan }, { status: 201 });
}
