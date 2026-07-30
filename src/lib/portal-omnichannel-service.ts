/**
 * Portal Omnichannel Service — Volume 03
 *
 * Dispatcher de notificações por canal:
 *   EMAIL     — Resend (transaccional)
 *   WHATSAPP  — Meta Cloud API (opt-in obrigatório, placeholder v1)
 *   IN_APP    — SSE (entrega via stream — marcar DELIVERED ao chegar ao cliente)
 *   PUSH_WEB  — VAPID Web Push (web-push library)
 *
 * Regra BR-PORT-005: falha num canal → fallback automático para EMAIL.
 * Regra BR-PORT-004: toda mensagem tem estado final registado.
 *
 * Fluxo:
 *   1. dispatchNotification(notificationId) — chamado pelo cron de re-tentativas
 *   2. Detecta canal da notificação
 *   3. Despacha para o canal correcto
 *   4. Regista OmnichannelMessage (audit trail)
 *   5. Actualiza status da PortalNotification
 *   6. Em caso de falha → markAsFailed (agenda retry ou FAILED definitivo)
 */

import { prisma }                    from "@/lib/prisma";
import {
  markAsSent,
  markAsDelivered,
  markAsFailed,
  recordOmnichannelMessage,
  createNotification,
} from "@/lib/portal-notification-service";
import {
  NotificationStatus,
  OmnichannelType,
  PortalAlertType,
} from "@prisma/client";

// ── Email (Resend) ─────────────────────────────────────────────────────────────

async function sendEmail(params: {
  to:           string;
  subject:      string;
  body:         string;
  notificationId: string;
  companyId:    string;
}): Promise<{ ok: boolean; externalId?: string; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { ok: false, error: "RESEND_NOT_CONFIGURED" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    process.env.RESEND_FROM_EMAIL ?? "noreply@azulcowork.com",
        to:      [params.to],
        subject: params.subject,
        html:    `<p>${params.body.replace(/\n/g, "<br>")}</p>`,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: JSON.stringify(err) };
    }

    const data = await res.json() as { id?: string };
    return { ok: true, externalId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "NETWORK_ERROR" };
  }
}

// ── WhatsApp (Meta Cloud API) — placeholder v1 ────────────────────────────────

async function sendWhatsApp(params: {
  to:   string;  // +244XXXXXXXXX
  body: string;
}): Promise<{ ok: boolean; externalId?: string; error?: string }> {
  const waToken   = process.env.META_WHATSAPP_TOKEN;
  const waPhoneId = process.env.META_WHATSAPP_PHONE_ID;

  if (!waToken || !waPhoneId) {
    return { ok: false, error: "WHATSAPP_NOT_CONFIGURED" };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${waPhoneId}/messages`,
      {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${waToken}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to:                params.to,
          type:              "text",
          text:              { body: params.body },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: JSON.stringify(err) };
    }

    const data = await res.json() as { messages?: Array<{ id: string }> };
    return { ok: true, externalId: data.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "NETWORK_ERROR" };
  }
}

// ── PUSH_WEB (VAPID) ──────────────────────────────────────────────────────────

async function sendPushNotification(params: {
  endpoint: string;
  p256dh:   string;
  auth:     string;
  title:    string;
  body:     string;
  actionUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  // web-push library (opcional — instalar: npm install web-push)
  // Se não disponível, retorna erro graciosamente
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpush = require("web-push");

    const vapidPublic  = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail   = process.env.VAPID_EMAIL ?? "mailto:geral@azulcowork.com";

    if (!vapidPublic || !vapidPrivate) {
      return { ok: false, error: "VAPID_NOT_CONFIGURED" };
    }

    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

    await webpush.sendNotification(
      { endpoint: params.endpoint, keys: { p256dh: params.p256dh, auth: params.auth } },
      JSON.stringify({ title: params.title, body: params.body, url: params.actionUrl })
    );

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PUSH_ERROR";
    // 410 Gone = subscrição expirada — limpar do utilizador
    if (msg.includes("410") || msg.includes("404")) {
      return { ok: false, error: "SUBSCRIPTION_EXPIRED" };
    }
    return { ok: false, error: msg };
  }
}

// ── Dispatcher principal ───────────────────────────────────────────────────────

/**
 * Despacha uma notificação PENDING pelo seu canal.
 * Chamado pelo cron /api/cron/portal-notifications-retry.
 */
export async function dispatchNotification(notificationId: string): Promise<void> {
  const notif = await prisma.portalNotification.findUnique({
    where:  { id: notificationId },
    select: {
      id:          true,
      companyId:   true,
      portalUserId:true,
      channel:     true,
      type:        true,
      title:       true,
      body:        true,
      actionUrl:   true,
      status:      true,
      attempts:    true,
      maxAttempts: true,
      portalUser: {
        select: {
          email:        true,
          whatsapp:     true,  // campo phone ou whatsapp do PortalUser
          pushEndpoint: true,
          pushP256dh:   true,
          pushAuth:     true,
        },
      },
    },
  });

  if (!notif) return;
  if (notif.status !== NotificationStatus.PENDING) return;

  const { channel, title, body, actionUrl, portalUser } = notif;

  let result: { ok: boolean; externalId?: string; error?: string } = { ok: false };

  // ── Despacho por canal ──────────────────────────────────────────────────────
  if (channel === OmnichannelType.EMAIL && portalUser?.email) {
    result = await sendEmail({
      to:             portalUser.email,
      subject:        title,
      body,
      notificationId: notif.id,
      companyId:      notif.companyId,
    });

  } else if (channel === OmnichannelType.WHATSAPP && portalUser?.whatsapp) {
    result = await sendWhatsApp({ to: portalUser.whatsapp, body: `${title}\n\n${body}` });

  } else if (channel === OmnichannelType.IN_APP) {
    // IN_APP é entregue pelo SSE stream — marcar directamente como SENT
    // (DELIVERED é marcado quando o cliente recebe pelo stream)
    result = { ok: true };

  } else if (channel === OmnichannelType.PUSH_WEB
    && portalUser?.pushEndpoint && portalUser?.pushP256dh && portalUser?.pushAuth) {
    result = await sendPushNotification({
      endpoint:  portalUser.pushEndpoint,
      p256dh:    portalUser.pushP256dh,
      auth:      portalUser.pushAuth,
      title,
      body,
      actionUrl: actionUrl ?? undefined,
    });

    // Limpar subscrição expirada
    if (result.error === "SUBSCRIPTION_EXPIRED" && notif.portalUserId) {
      prisma.portalUser.update({
        where: { id: notif.portalUserId },
        data:  { pushEndpoint: null, pushP256dh: null, pushAuth: null, notifyPush: false },
      }).catch(e => console.error("[Omnichannel] Falha ao limpar subscrição expirada:", e));
    }

  } else {
    // Canal sem dados de contacto — fallback para EMAIL
    result = { ok: false, error: "MISSING_CONTACT_FOR_CHANNEL" };
  }

  // ── Processar resultado ────────────────────────────────────────────────────
  const recipient = channel === OmnichannelType.EMAIL  ? (portalUser?.email  ?? "unknown")
                  : channel === OmnichannelType.WHATSAPP ? (portalUser?.whatsapp ?? "unknown")
                  : channel === OmnichannelType.PUSH_WEB  ? (portalUser?.pushEndpoint ?? "push")
                  : `in-app:${notif.portalUserId}`;

  await recordOmnichannelMessage({
    companyId:      notif.companyId,
    channel,
    recipient,
    body,
    status:         result.ok ? NotificationStatus.SENT : NotificationStatus.FAILED,
    externalId:     result.externalId,
    notificationId: notif.id,
    failedReason:   result.error,
  });

  if (result.ok) {
    await markAsSent(notif.id, result.externalId);
    if (channel === OmnichannelType.IN_APP) {
      // IN_APP não tem confirmação externa — marcar DELIVERED imediatamente
      await markAsDelivered(notif.id);
    }
  } else {
    // Falha → tentar fallback para EMAIL se canal era outro
    if (channel !== OmnichannelType.EMAIL && portalUser?.email) {
      const fallbackResult = await sendEmail({
        to:             portalUser.email,
        subject:        `[Fallback] ${title}`,
        body:           `(Canal original: ${channel})\n\n${body}`,
        notificationId: notif.id,
        companyId:      notif.companyId,
      });

      // Criar nova notificação EMAIL como fallback (audit)
      await createNotification({
        companyId:    notif.companyId,
        portalUserId: notif.portalUserId ?? undefined,
        type:         notif.type as PortalAlertType,
        channel:      OmnichannelType.EMAIL,
        title:        `[Fallback] ${title}`,
        body,
        actionUrl:    actionUrl ?? undefined,
      });

      await recordOmnichannelMessage({
        companyId:   notif.companyId,
        channel:     OmnichannelType.EMAIL,
        recipient:   portalUser.email,
        body:        `[FALLBACK de ${channel}] ${body}`,
        status:      fallbackResult.ok ? NotificationStatus.SENT : NotificationStatus.FAILED,
        externalId:  fallbackResult.externalId,
        failedReason:fallbackResult.error,
        metadata:    { originalChannel: channel, originalNotificationId: notif.id },
      });
    }

    await markAsFailed(notif.id, result.error);
  }
}

/**
 * Processa todas as notificações PENDING prontas para re-tentativa.
 * Chamado pelo cron /api/cron/portal-notifications-retry (a cada 5 min).
 */
export async function processPendingNotifications(): Promise<{ processed: number; failed: number }> {
  const pending = await prisma.portalNotification.findMany({
    where: {
      status:      NotificationStatus.PENDING,
      nextRetryAt: { lte: new Date() },
    },
    select: { id: true },
    take:   50,  // processar máximo 50 por ciclo
  });

  let processed = 0;
  let failed    = 0;

  await Promise.allSettled(
    pending.map(async ({ id }) => {
      try {
        await dispatchNotification(id);
        processed++;
      } catch (err) {
        console.error(`[Omnichannel] Erro ao processar notificação ${id}:`, err);
        await markAsFailed(id, err instanceof Error ? err.message : "UNKNOWN");
        failed++;
      }
    })
  );

  return { processed, failed };
}
