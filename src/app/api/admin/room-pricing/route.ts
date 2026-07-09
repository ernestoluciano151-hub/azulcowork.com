/**
 * GET  /api/admin/room-pricing        → list all tiers (ordered by sortOrder)
 * POST /api/admin/room-pricing        → create new tier
 * PUT  /api/admin/room-pricing        → bulk-upsert (replace all for a roomId)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const roomId = new URL(req.url).searchParams.get("roomId") || "sala-reuniao";

  const tiers = await prisma.roomPricing.findMany({
    where:   { roomId, active: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ tiers });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const { roomId = "sala-reuniao", label, durationMinutes, price, sortOrder } = body;

  if (!label || !durationMinutes || price === undefined) {
    return NextResponse.json({ error: "label, durationMinutes e price são obrigatórios." }, { status: 400 });
  }

  const tier = await prisma.roomPricing.create({
    data: {
      roomId,
      label,
      durationMinutes: Number(durationMinutes),
      price:           Number(price),
      sortOrder:       Number(sortOrder) || 0,
    },
  });

  return NextResponse.json({ tier }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const { tiers, roomId = "sala-reuniao" } = body as {
    roomId?: string;
    tiers: Array<{ id?: string; label: string; durationMinutes: number; price: number; active?: boolean; sortOrder?: number }>;
  };

  if (!Array.isArray(tiers)) return NextResponse.json({ error: "tiers deve ser um array." }, { status: 400 });

  // Upsert each tier inside a transaction
  const result = await prisma.$transaction(
    tiers.map((t, i) =>
      t.id
        ? prisma.roomPricing.update({
            where: { id: t.id },
            data: {
              label:           t.label,
              durationMinutes: Number(t.durationMinutes),
              price:           Number(t.price),
              active:          t.active ?? true,
              sortOrder:       t.sortOrder ?? i,
            },
          })
        : prisma.roomPricing.create({
            data: {
              roomId,
              label:           t.label,
              durationMinutes: Number(t.durationMinutes),
              price:           Number(t.price),
              active:          t.active ?? true,
              sortOrder:       t.sortOrder ?? i,
            },
          })
    )
  );

  return NextResponse.json({ tiers: result });
}
