import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const plans = await prisma.meetingPlan.findMany({
    where: { active: true },
    orderBy: { name: "asc" }
  });

  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const { name, maxPeople, description, coffeeBreakAvailable, customPricingAllowed, minHoursForCustom } = body;

  if (!name || !maxPeople) {
    return NextResponse.json({ error: "Nome e capacidade máxima são obrigatórios." }, { status: 400 });
  }

  const plan = await prisma.meetingPlan.create({
    data: {
      name,
      maxPeople:            Number(maxPeople),
      description:          description          || null,
      coffeeBreakAvailable: coffeeBreakAvailable ?? true,
      customPricingAllowed: customPricingAllowed ?? false,
      minHoursForCustom:    minHoursForCustom    ? Number(minHoursForCustom) : 16,
      pricePerHour:         body.pricePerHour     ? Number(body.pricePerHour)     : 0,
      coffeeBreakPrice:     body.coffeeBreakPrice ? Number(body.coffeeBreakPrice) : 0,
      halfDayPrice:         body.halfDayPrice     ? Number(body.halfDayPrice)     : 0,
      fullDayPrice:         body.fullDayPrice     ? Number(body.fullDayPrice)     : 0,
      weekendPrice:         body.weekendPrice     ? Number(body.weekendPrice)     : 0,
      promoPrice:           body.promoPrice       ? Number(body.promoPrice)       : 0,
    }
  });

  return NextResponse.json({ plan }, { status: 201 });
}
