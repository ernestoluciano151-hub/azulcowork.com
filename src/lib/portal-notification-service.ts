/**
 * Portal Notification Service — Volume 03
 *
 * Máquina de estados de notificações do portal:
 *   PENDING → SENT → DELIVERED → READ
 *                  ↘ FAILED (max 3 tentativas, backoff 5/30 min)
 *
 * Regra BR-PORT-004: toda OmnichannelMessage tem estado final.
 * Regra BR-PORT-005: falha num canal → fallback automático para EMAIL.
 *
 * Canais:
 *   EMAIL     — Resend (transaccional)
 *   WHATSAPP  — Meta Cloud API (placeholder v1 — opt-in obrigatório)
 *   IN_APP    — SSE (Server-Sent Events)
 *   PUSH_WEB  — VAPID Web Push
 *
 * Re-tentativas (geridas pelo cron /api/cron/portal-notifications-retry):
 *   Tentativa 1: imediata
 *   Tentativa 2: +5 minutos
 *   Tentativa 3: +30 minutos
 *   Após 3 falhas: status → FAILED (definitivo)
 */

import { prisma }                from "@/lib/prisma";
import {
  NotificationStatus,
  OmnichannelType,
  PortalAlertType,
  TimelineEventType,
} from "@prisma/client";

// ── Constantes ─────────────────────────────────────────────────────────────────

export const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MINUTES = [0, 5, 30] as const;  // tentativa 1=0min, 2=5min, 3=30min

// ── Estado da máquina de notificações ─────────────────────────────────────────

export function isTerminalStatus(status: NotificationStatus): boolean {
  return status === NotificationStatus.READ || status === NotificationStatus.FAILED;
}

export function canRetry(attempts: number, maxAttempts: number): boolean {
  return attempts < maxAttempts && attempts < MAX_RETRY_ATTEMPTS;
}

export function nextRetryAt(attempt: number): Date {
  const backoffMinutes = RETRY_BACKOFF_MINUTES[attempt] ?? 30;
  return new Date(Date.now() + backoffMinutes * 60 * 1000);
}

// ── Criação de notificação ─────────────────────────────────────────────────────

export interface CreateNotificationParams {
  companyId:    string;
  portalUserId?: string;
  type:          PortalAlertType;
  channel:       OmnichannelType;
  title:         string;
  body:          string;
  actionUrl?:    string;
  invoiceId?:    string;
  contractId?:   string;
  documentId?:   string;
  bookingId?:    string;
}

export async function createNotification(params: CreateNotificationParams): Promise<string> {
  const notif = await prisma.portalNotification.create({
    data: {
      ...params,
      status:      NotificationStatus.PENDING,
      attempts:    0,
      maxAttempts: MAX_RETRY_ATTEMPTS,
      nextRetryAt: new Date(),  // disponível imediatamente para o cron
    },
  });
  return notif.id;
}

/**
 * Cria notificações em todos os canais preferidos do utilizador.
 * Respeita as preferências: notifyEmail, notifyWhatsapp, notifyInApp, notifyPush.
 */
export async function notifyUser(params: {
  companyId:    string;
  portalUserId: string;
  type:          PortalAlertType;
  title:         string;
  body:          string;
  actionUrl?:    string;
  invoiceId?:    string;
  contractId?:   string;
  documentId?:   string;
  bookingId?:    string;
}): Promise<string[]> {
  const user = await prisma.portalUser.findUnique({
    where:  { id: params.portalUserId },
    select: {
      notifyEmail:    true,
      notifyWhatsapp: true,
      notifyInApp:    true,
      notifyPush:     true,
      pushEndpoint:   true,
    },
  });

  if (!user) throw new Error("PORTAL_USER_NOT_FOUND");

  const channels: OmnichannelType[] = [];
  if (user.notifyInApp)                  channels.push(OmnichannelType.IN_APP);
  if (user.notifyEmail)                  channels.push(OmnichannelType.EMAIL);
  if (user.notifyPush && user.pushEndpoint) channels.push(OmnichannelType.PUSH_WEB);
  if (user.notifyWhatsapp)               channels.push(OmnichannelType.WHATSAPP);

  // Garantir pelo menos EMAIL se nenhum canal preferido está activo
  if (channels.length === 0) channels.push(OmnichannelType.EMAIL);

  const ids = await Promise.all(
    channels.map(channel => createNotification({ ...params, channel }))
  );

  return ids;
}

/**
 * Marca notificação como enviada (PENDING → SENT).
 */
export async function markAsSent(
  notificationId: string,
  externalId?: string
): Promise<void> {
  await prisma.portalNotification.update({
    where: { id: notificationId },
    data: {
      status:  NotificationStatus.SENT,
      sentAt:  new Date(),
      nextRetryAt: null,
    },
  });
}

/**
 * Marca notificação como entregue (SENT → DELIVERED).
 */
export async function markAsDelivered(notificationId: string): Promise<void> {
  await prisma.portalNotification.update({
    where: { id: notificationId },
    data: {
      status:      NotificationStatus.DELIVERED,
      deliveredAt: new Date(),
    },
  });
}

/**
 * Marca notificação como lida (DELIVERED | SENT → READ).
 * Verifica que pertence ao utilizador autenticado.
 */
export async function markAsRead(
  notificationId: string,
  portalUserId:   string,
  companyId:      string
): Promise<boolean> {
  const notif = await prisma.portalNotification.findFirst({
    where: {
      id:          notificationId,
      companyId,
      portalUserId,
      status:      { not: NotificationStatus.FAILED },
    },
  });
  if (!notif) return false;
  if (notif.status === NotificationStatus.READ) return true;  // idempotente

  await prisma.portalNotification.update({
    where: { id: notificationId },
    data:  { status: NotificationStatus.READ, readAt: new Date() },
  });
  return true;
}

/**
 * Marca todas as notificações do utilizador como lidas.
 * Bulk update de IN_APP e EMAIL não-terminais.
 */
export async function markAllAsRead(
  portalUserId: string,
  companyId:    string
): Promise<number> {
  const result = await prisma.portalNotification.updateMany({
    where: {
      portalUserId,
      companyId,
      status: { in: [NotificationStatus.PENDING, NotificationStatus.SENT, NotificationStatus.DELIVERED] },
    },
    data: {
      status: NotificationStatus.READ,
      readAt: new Date(),
    },
  });
  return result.count;
}

/**
 * Regista falha de entrega.
 * Se ainda tem tentativas → agenda próxima retry.
 * Caso contrário → FAILED definitivo.
 */
export async function markAsFailed(
  notificationId: string,
  reason?:        string
): Promise<void> {
  const notif = await prisma.portalNotification.findUnique({
    where:  { id: notificationId },
    select: { attempts: true, maxAttempts: true },
  });
  if (!notif) return;

  const newAttempts = notif.attempts + 1;
  const willRetry   = canRetry(newAttempts, notif.maxAttempts);

  await prisma.portalNotification.update({
    where: { id: notificationId },
    data: {
      attempts:    newAttempts,
      status:      willRetry ? NotificationStatus.PENDING : NotificationStatus.FAILED,
      failedAt:    willRetry ? undefined : new Date(),
      nextRetryAt: willRetry ? nextRetryAt(newAttempts) : null,
    },
  });
}

/**
 * Regista mensagem omnicanal (audit trail).
 * Chamado após cada tentativa de envio.
 */
export async function recordOmnichannelMessage(params: {
  companyId:      string;
  channel:        OmnichannelType;
  recipient:      string;
  body:           string;
  template?:      string;
  status:         NotificationStatus;
  externalId?:    string;
  notificationId?: string;
  failedReason?:  string;
  metadata?:      object;
}): Promise<void> {
  await prisma.omnichannelMessage.create({
    data: {
      ...params,
      sentAt:    params.status === NotificationStatus.SENT ? new Date() : undefined,
      metadata:  params.metadata as Parameters<typeof prisma.omnichannelMessage.create>[0]["data"]["metadata"],
    },
  });
}

/**
 * Conta notificações não lidas do utilizador (para badge no portal).
 */
export async function getUnreadCount(
  portalUserId: string,
  companyId:    string
): Promise<number> {
  return prisma.portalNotification.count({
    where: {
      portalUserId,
      companyId,
      channel: OmnichannelType.IN_APP,
      status:  { in: [NotificationStatus.PENDING, NotificationStatus.SENT, NotificationStatus.DELIVERED] },
    },
  });
}

export { NotificationStatus, OmnichannelType, PortalAlertType };
