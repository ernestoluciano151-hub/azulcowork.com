/**
 * PATCH  /api/admin/room-pricing/[id]  → update a tier
 * DELETE /api/admin/room-pricing/[id]  → soft-delete (active=false)
 */
import { NextRequest, NextResponse } from "next/server";
import { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.label           !== undefined) data.label           = body.label;
  if (body.durationMinutes !== undefined) data.durationMinutes = Number(body.durationMinutes);
  if (body.price           !== undefined) data.price           = Number(body.price);
  if (body.sortOrder       !== undefined) data.sortOrder       = Number(body.sortOrder);
  if (body.active          !== undefined) data.active          = Boolean(body.active);

  const tier = await prisma.roomPricing.update({ where: { id: params.id }, data });
  return NextResponse.json({ tier });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  await prisma.roomPricing.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
