/**
 * POST   /api/portal/notifications/subscribe-push  — registar subscrição Web Push
 * DELETE /api/portal/notifications/subscribe-push  — cancelar subscrição Web Push
 *
 * ADR-030: VAPID Web Push para notificações browser.
 * Armazena pushEndpoint + pushP256dh + pushAuth no PortalUser.
 *
 * Body POST: { endpoint: string, p256dh: string, auth: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession }      from "@/lib/portal-auth-service";
import { prisma }                    from "@/lib/prisma";
import { z }                         from "zod";

const subscribeSchema = z.object({
  endpoint: z.string().url("Endpoint inválido."),
  p256dh:   z.string().min(10, "Chave p256dh inválida."),
  auth:     z.string().min(10, "Chave auth inválida."),
});

// ── POST — registar subscrição ─────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const body = await req.json();
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const { endpoint, p256dh, auth } = parsed.data;

    await prisma.portalUser.update({
      where: { id: user.sub },
      data: {
        pushEndpoint: endpoint,
        pushP256dh:   p256dh,
        pushAuth:     auth,
        notifyPush:   true,
      },
    });

    return NextResponse.json({ ok: true, message: "Subscrição Web Push registada." });
  } catch (err) {
    console.error("[POST /api/portal/notifications/subscribe-push]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}

// ── DELETE — cancelar subscrição ───────────────────────────────────────────────

export async function DELETE(_req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    await prisma.portalUser.update({
      where: { id: user.sub },
      data: {
        pushEndpoint: null,
        pushP256dh:   null,
        pushAuth:     null,
        notifyPush:   false,
      },
    });

    return NextResponse.json({ ok: true, message: "Subscrição Web Push removida." });
  } catch (err) {
    console.error("[DELETE /api/portal/notifications/subscribe-push]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
