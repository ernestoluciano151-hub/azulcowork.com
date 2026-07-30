/**
 * GET /api/portal/notifications/stream
 *
 * SSE (Server-Sent Events) para notificações IN_APP em tempo real.
 * ADR-030: SSE sem WebSocket — menos overhead, adequado para o volume do portal.
 *
 * Protocolo:
 *   event: connected    — heartbeat inicial (confirma ligação)
 *   event: notification — nova notificação { id, type, title, body, actionUrl, createdAt }
 *   event: ping         — heartbeat cada 30 segundos (mantém conexão viva)
 *
 * Implementação:
 *   - Polling ao DB a cada 10 segundos para novas notificações
 *   - Heartbeat cada 30 segundos
 *   - Timeout máximo de 5 minutos (cliente deve reconectar)
 *   - Apenas notificações IN_APP com status PENDING após lastSeen
 *
 * Nota: em produção com muitos clientes, este padrão deve ser substituído
 * por Redis Pub/Sub + SSE. Para o volume actual do Azul Coworking (< 50 clientes),
 * o polling ao DB é suficiente.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession }      from "@/lib/portal-auth-service";
import { prisma }                    from "@/lib/prisma";
import { OmnichannelType, NotificationStatus } from "@prisma/client";

const POLL_INTERVAL_MS  = 10_000;  // poll a cada 10 segundos
const PING_INTERVAL_MS  = 30_000;  // heartbeat cada 30 segundos
const MAX_DURATION_MS   = 5 * 60 * 1000;  // 5 minutos máximo

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { user, error } = await requirePortalSession();
  if (error) return error;

  const encoder  = new TextEncoder();
  const lastSeen = new Date();  // apenas notificações criadas após esta conexão

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // cliente desconectou — ignorar
        }
      };

      // Evento inicial
      send("connected", { userId: user.sub, timestamp: new Date().toISOString() });

      let elapsed    = 0;
      let lastPingAt = Date.now();
      let since      = lastSeen;

      const interval = setInterval(async () => {
        elapsed += POLL_INTERVAL_MS;

        // Terminar após 5 minutos
        if (elapsed >= MAX_DURATION_MS) {
          send("timeout", { message: "Conexão SSE expirada. Por favor reconecte." });
          clearInterval(interval);
          controller.close();
          return;
        }

        // Heartbeat
        if (Date.now() - lastPingAt >= PING_INTERVAL_MS) {
          send("ping", { timestamp: new Date().toISOString() });
          lastPingAt = Date.now();
        }

        // Poll por novas notificações IN_APP
        try {
          const notifications = await prisma.portalNotification.findMany({
            where: {
              portalUserId: user.sub,
              companyId:    user.companyId,
              channel:      OmnichannelType.IN_APP,
              status:       NotificationStatus.PENDING,
              createdAt:    { gt: since },
            },
            orderBy: { createdAt: "asc" },
            select: {
              id:        true,
              type:      true,
              title:     true,
              body:      true,
              actionUrl: true,
              createdAt: true,
            },
            take: 10,
          });

          for (const notif of notifications) {
            send("notification", notif);
            since = notif.createdAt;

            // Marcar como entregue (PENDING → DELIVERED via IN_APP)
            prisma.portalNotification.update({
              where: { id: notif.id },
              data: {
                status:      NotificationStatus.DELIVERED,
                sentAt:      new Date(),
                deliveredAt: new Date(),
              },
            }).catch(e => console.error("[SSE] Falha ao marcar DELIVERED:", e));
          }
        } catch (e) {
          console.error("[SSE] Erro ao poll notificações:", e);
        }
      }, POLL_INTERVAL_MS);

      // Limpar interval se cliente desconectar antes do timeout
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try { controller.close(); } catch { /* já fechado */ }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",  // desactivar buffering no nginx
    },
  });
}
