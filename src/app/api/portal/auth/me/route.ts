/**
 * GET /api/portal/auth/me
 *
 * Retorna os dados do PortalUser autenticado e informação da empresa.
 * Requer cookie portal-session válido.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    // Buscar dados actualizados do utilizador e empresa
    const portalUser = await prisma.portalUser.findUnique({
      where: { id: user.sub },
      select: {
        id:             true,
        email:          true,
        name:           true,
        phone:          true,
        role:           true,
        isActive:       true,
        isConfirmed:    true,
        notifyEmail:    true,
        notifyWhatsapp: true,
        notifyPush:     true,
        notifyInApp:    true,
        lastLoginAt:    true,
        createdAt:      true,
        company: {
          select: {
            id:           true,
            name:         true,
            nif:          true,
            email:        true,
            whatsapp:     true,
            responsible:  true,
            contractStatus: true,
            paymentStatus:  true,
          },
        },
      },
    });

    if (!portalUser || !portalUser.isActive) {
      return NextResponse.json(
        { error: "Sessão inválida. Por favor faça login novamente." },
        { status: 401 }
      );
    }

    return NextResponse.json({ data: portalUser });
  } catch (err) {
    console.error("[GET /api/portal/auth/me]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
