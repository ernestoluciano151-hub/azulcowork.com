/**
 * POST /api/portal/users/[id]/transfer-ownership
 *
 * Transfere a role PORTAL_OWNER para outro utilizador activo da empresa.
 * Só o actual PORTAL_OWNER pode executar esta operação.
 *
 * Regras:
 *  - Máximo 1 PORTAL_OWNER por empresa (invariante do sistema)
 *  - O utilizador alvo deve estar activo e confirmado
 *  - O utilizador alvo deve ser da mesma empresa
 *  - O actor fica com role PORTAL_ADMIN após a transferência
 *  - Operação em prisma.$transaction (atomicidade)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalRole } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";
import { PortalRole } from "@prisma/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Só PORTAL_OWNER pode transferir a propriedade
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_OWNER);
    if (error) return error;

    const { id } = await params;

    // Não pode transferir para si próprio
    if (user.sub === id) {
      return NextResponse.json(
        { error: "Não pode transferir a propriedade para si próprio." },
        { status: 409 }
      );
    }

    // Verificar que o alvo existe, está na mesma empresa, activo e confirmado
    const target = await prisma.portalUser.findFirst({
      where: {
        id,
        companyId: user.companyId,  // isolamento multi-tenant
      },
      select: {
        id:          true,
        name:        true,
        email:       true,
        isActive:    true,
        isConfirmed: true,
        role:        true,
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    if (!target.isActive) {
      return NextResponse.json(
        { error: "Não é possível transferir a propriedade para um utilizador desactivado." },
        { status: 409 }
      );
    }

    if (!target.isConfirmed) {
      return NextResponse.json(
        { error: "O utilizador alvo ainda não confirmou a sua conta. Aguarde o primeiro login." },
        { status: 409 }
      );
    }

    // Transferência atómica:
    //   1. alvo → PORTAL_OWNER
    //   2. actor → PORTAL_ADMIN
    await prisma.$transaction([
      prisma.portalUser.update({
        where: { id },
        data:  { role: PortalRole.PORTAL_OWNER },
      }),
      prisma.portalUser.update({
        where: { id: user.sub },
        data:  { role: PortalRole.PORTAL_ADMIN },
      }),
    ]);

    return NextResponse.json({
      ok:      true,
      message: `Propriedade transferida para ${target.name} (${target.email}). `
        + "A sua conta passou para Administrador.",
    });
  } catch (err) {
    console.error("[POST /api/portal/users/[id]/transfer-ownership]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
