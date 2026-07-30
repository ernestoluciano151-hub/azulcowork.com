import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const leadId    = searchParams.get("leadId");

  if (!companyId && !leadId) return NextResponse.json({ timeline: [] });

  const where: Record<string, unknown> = {};
  if (companyId) where.companyId = companyId;
  if (leadId)    where.leadId    = leadId;

  const timeline = await prisma.timeline.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    timeline: timeline.map(t => ({ ...t, createdAt: t.createdAt.toISOString() }))
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const body = await req.json();
  const { companyId, leadId, type, title, description, amount, referenceId, referenceType } = body;

  if (!type || !title) return NextResponse.json({ error: "type e title são obrigatórios." }, { status: 400 });

  const entry = await prisma.timeline.create({
    data: {
      companyId:     companyId     || null,
      leadId:        leadId        || null,
      type,
      title,
      description:   description   || null,
      amount:        amount        ?? null,
      referenceId:   referenceId   || null,
      referenceType: referenceType || null,
      createdBy:     session.name || session.email,
    },
  });

  return NextResponse.json({ entry: { ...entry, createdAt: entry.createdAt.toISOString() } }, { status: 201 });
}
