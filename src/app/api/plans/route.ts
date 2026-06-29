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
      maxPeople: Number(maxPeople),
      description: description || null,
      coffeeBreakAvailable: coffeeBreakAvailable ?? true,
      customPricingAllowed: customPricingAllowed ?? false,
      minHoursForCustom: minHoursForCustom ? Number(minHoursForCustom) : 16,
    }
  });

  return NextResponse.json({ plan }, { status: 201 });
}
