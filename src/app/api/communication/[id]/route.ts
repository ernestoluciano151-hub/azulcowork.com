/**
 * GET /api/communication/[id]  — detalhe completo de um CommunicationLog
 *
 * Permissões: ADMIN ou FINANCEIRO
 * VOL07 — Sprint VOL07-2
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = await requireRole(req, ["ADMIN", "FINANCEIRO"]);
  if (authErr) return authErr;

  const log = await prisma.communicationLog.findUnique({
    where: { id: params.id },
  });

  if (!log) {
    return NextResponse.json({ error: "Log não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ log });
}
