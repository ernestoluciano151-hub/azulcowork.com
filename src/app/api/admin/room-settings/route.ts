import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const settings = await getOrCreate();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
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
      updatedBy:           (session as { name?: string; email?: string }).name || (session as { name?: string; email?: string }).email,
    },
  });

  return NextResponse.json({ settings: updated });
}
