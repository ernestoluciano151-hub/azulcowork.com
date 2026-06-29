import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ requests: [] });

  const requests = await prisma.deleteRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

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
