import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole, requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const requests = await prisma.deleteRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { entityType, entityId, entityLabel, reason } = await req.json();
  if (!entityType || !entityId || !entityLabel || !reason) {
    return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
  }

  const request = await prisma.deleteRequest.create({
    data: {
      requestedBy: session.sub,
      entityType,
      entityId,
      entityLabel,
      reason,
    },
  });
  return NextResponse.json({ request }, { status: 201 });
}
