/**
 * GET /api/admin/plan-prices — preços por plano de coworking (ADMIN, COMERCIAL, FINANCEIRO)
 * PUT /api/admin/plan-prices — actualizar preços (ADMIN)
 *   body: { prices: [{ planType, monthlyPrice, dailyPrice? }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getPlanPrices } from "@/lib/plan-prices";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO);
  if (error) return error;
  try {
    return NextResponse.json({ prices: await getPlanPrices() });
  } catch (err) {
    console.error("[GET /api/admin/plan-prices]", err);
    Sentry.captureException(err, { tags: { route: "admin/plan-prices" } });
    return NextResponse.json({ error: "Erro ao obter preços dos planos." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  try {
    const body = await req.json();
    const prices = body?.prices;
    if (!Array.isArray(prices) || prices.length === 0) {
      return NextResponse.json({ error: "'prices' deve ser uma lista." }, { status: 400 });
    }

    const known = new Set((await getPlanPrices()).map(p => p.planType));
    for (const p of prices) {
      if (!known.has(p?.planType)) {
        return NextResponse.json({ error: `Plano desconhecido: ${p?.planType}.` }, { status: 400 });
      }
      const monthly = Number(p.monthlyPrice);
      if (!Number.isFinite(monthly) || monthly < 0) {
        return NextResponse.json({ error: `Preço mensal inválido para ${p.planType}.` }, { status: 400 });
      }
      if (p.dailyPrice !== null && p.dailyPrice !== undefined && p.dailyPrice !== "") {
        const daily = Number(p.dailyPrice);
        if (!Number.isFinite(daily) || daily < 0) {
          return NextResponse.json({ error: `Preço diário inválido para ${p.planType}.` }, { status: 400 });
        }
      }
    }

    const updatedBy = session.name || session.email;
    await prisma.$transaction(
      prices.map((p: { planType: string; monthlyPrice: number | string; dailyPrice?: number | string | null }) =>
        prisma.coworkingPlanPrice.update({
          where: { planType: p.planType },
          data: {
            monthlyPrice: Number(p.monthlyPrice),
            dailyPrice:   p.dailyPrice === null || p.dailyPrice === undefined || p.dailyPrice === "" ? null : Number(p.dailyPrice),
            updatedBy,
          },
        })
      )
    );

    return NextResponse.json({ prices: await getPlanPrices() });
  } catch (err) {
    console.error("[PUT /api/admin/plan-prices]", err);
    Sentry.captureException(err, { tags: { route: "admin/plan-prices" } });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao guardar preços: ${msg}` }, { status: 500 });
  }
}
