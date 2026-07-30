/**
 * PATCH /api/portal/auth/preferences
 *
 * Actualizar preferências de notificação do utilizador autenticado.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  notifyEmail:    z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
  notifyPush:     z.boolean().optional(),
  notifyInApp:    z.boolean().optional(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos." },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Pelo menos um campo deve ser fornecido
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nenhuma preferência fornecida para actualizar." },
        { status: 400 }
      );
    }

    const updated = await prisma.portalUser.update({
      where: { id: user.sub },
      data,
      select: {
        notifyEmail:    true,
        notifyWhatsapp: true,
        notifyPush:     true,
        notifyInApp:    true,
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("[PATCH /api/portal/auth/preferences]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
