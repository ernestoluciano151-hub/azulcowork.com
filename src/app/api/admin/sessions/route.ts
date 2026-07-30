import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/sessions
 *
 * Retorna as sessões activas do utilizador autenticado.
 * Cada utilizador só vê as suas próprias sessões (não as dos outros admins).
 * Sessões expiradas ou revogadas são excluídas automaticamente.
 */
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const sessions = await prisma.adminSession.findMany({
    where: {
      adminUserId: session.sub,
      isRevoked:   false,
      expiresAt:   { gt: new Date() },
    },
    select: {
      id:           true,
      ipAddress:    true,
      userAgent:    true,
      lastActiveAt: true,
      createdAt:    true,
      expiresAt:    true,
    },
    orderBy: { lastActiveAt: "desc" },
  });

  return NextResponse.json({ sessions });
}
