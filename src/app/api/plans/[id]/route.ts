import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const data: any = {};

  const numberFields = ["maxPeople","pricePerHour","coffeeBreakPrice","halfDayPrice","fullDayPrice","weekendPrice","promoPrice","minHoursForCustom"];
  const boolFields   = ["coffeeBreakAvailable","customPricingAllowed","active"];
  const strFields    = ["name","description"];

  for (const f of strFields)   if (body[f] !== undefined) data[f] = body[f];
  for (const f of numberFields) if (body[f] !== undefined) data[f] = Number(body[f]);
  for (const f of boolFields)   if (body[f] !== undefined) data[f] = Boolean(body[f]);

  const plan = await prisma.meetingPlan.update({ where: { id: params.id }, data });
  return NextResponse.json({ plan });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  await prisma.meetingPlan.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
