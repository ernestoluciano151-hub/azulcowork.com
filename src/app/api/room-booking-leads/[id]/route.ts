import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;
  const data = await req.json();
  const lead = await prisma.roomBookingLead.update({ where: { id: params.id }, data });
  return NextResponse.json(lead);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;
  await prisma.roomBookingLead.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
