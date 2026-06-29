import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const data: any = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.maxPeople !== undefined) data.maxPeople = Number(body.maxPeople);
  if (body.description !== undefined) data.description = body.description;
  if (body.coffeeBreakAvailable !== undefined) data.coffeeBreakAvailable = body.coffeeBreakAvailable;
  if (body.customPricingAllowed !== undefined) data.customPricingAllowed = body.customPricingAllowed;
  if (body.minHoursForCustom !== undefined) data.minHoursForCustom = Number(body.minHoursForCustom);
  if (body.active !== undefined) data.active = body.active;

  const plan = await prisma.meetingPlan.update({ where: { id: params.id }, data });
  return NextResponse.json({ plan });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  await prisma.meetingPlan.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
