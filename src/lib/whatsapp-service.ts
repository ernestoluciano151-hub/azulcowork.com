/**
 * whatsapp-service.ts — VOL07
 *
 * Envio de mensagens WhatsApp com dois modos de operação:
 *
 *  1. Z-API (se WHATSAPP_API_URL + WHATSAPP_API_TOKEN configurados):
 *     POST para a API Z-API → envia mensagem directamente.
 *
 *  2. Deep-link (fallback):
 *     Gera URL wa.me/?phone=...&text=... para abertura manual.
 *
 * Em ambos os casos o envio é registado em CommunicationLog.
 * O caller decide qual o canal a usar — este serviço expõe:
 *   - sendWhatsApp()    — tenta Z-API, cai em deep-link se não configurado
 *   - buildDeepLink()   — gera URL wa.me (pure function, sem I/O)
 *
 * Docs: docs/10-comunicacao/README.md
 */

import { prisma } from "@/lib/prisma";

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type WhatsAppOptions = {
  /** Número de telemóvel com prefixo internacional, ex: "244923000000" */
  to: string;
  /** Corpo da mensagem (texto simples, sem markdown avançado) */
  body: string;
  /** Canal semântico para CommunicationLog */
  channel: "transactional" | "alert" | "reminder" | "receipt";
  /** Entidade de contexto opcional */
  entityType?: string;
  entityId?: string;
  /** Quem disparou */
  triggeredBy?: string;
};

export type WhatsAppResult = {
  success: boolean;
  mode: "zapi" | "deeplink";
  /** URL gerado (deep-link) ou ID de log Z-API */
  reference: string;
  /** ID do CommunicationLog criado */
  logId: string;
  error?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Normaliza número: remove espaços, hífens e parênteses. */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().+]/g, "");
}

/**
 * Gera URL de deep-link WhatsApp (wa.me).
 * Pure function — sem I/O.
 *
 * @example
 * buildDeepLink("244923000000", "Olá!") // "https://wa.me/244923000000?text=Ol%C3%A1!"
 */
export function buildDeepLink(phone: string, text: string): string {
  const normalized = normalizePhone(phone);
  const encoded    = encodeURIComponent(text);
  return `https://wa.me/${normalized}?text=${encoded}`;
}

function isZApiConfigured(): boolean {
  return !!(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN);
}

// ── Z-API send ─────────────────────────────────────────────────────────────────

async function sendViaZApi(phone: string, message: string): Promise<{ messageId: string }> {
  const url   = process.env.WHATSAPP_API_URL!;
  const token = process.env.WHATSAPP_API_TOKEN!;

  const res = await fetch(`${url}/send-text`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token":  token,
    },
    body: JSON.stringify({
      phone:   normalizePhone(phone),
      message,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(sem corpo)");
    throw new Error(`Z-API erro ${res.status}: ${text}`);
  }

  const data = await res.json() as { messageId?: string; id?: string };
  return { messageId: data.messageId ?? data.id ?? "unknown" };
}

// ── Função principal ───────────────────────────────────────────────────────────

/**
 * Envia mensagem WhatsApp.
 *
 * Modo Z-API: se WHATSAPP_API_URL e WHATSAPP_API_TOKEN estiverem configurados.
 * Modo deep-link: fallback automático — regista o URL em CommunicationLog
 *   com type=WHATSAPP_DEEPLINK para que o utilizador possa abrir manualmente.
 */
export async function sendWhatsApp(opts: WhatsAppOptions): Promise<WhatsAppResult> {
  const {
    to,
    body,
    channel,
    entityType,
    entityId,
    triggeredBy = "SYSTEM",
  } = opts;

  // ── Modo Z-API ────────────────────────────────────────────────────────────
  if (isZApiConfigured()) {
    let messageId = "";
    let success   = false;
    let errorMsg: string | undefined;

    try {
      const r = await sendViaZApi(to, body);
      messageId = r.messageId;
      success   = true;
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[whatsapp] Z-API falhou → ${to}:`, errorMsg);
    }

    const log = await prisma.communicationLog.create({
      data: {
        type:         "WHATSAPP",
        channel,
        to,
        body,
        status:       success ? "SENT" : "FAILED",
        attempts:     1,
        lastAttemptAt: new Date(),
        sentAt:       success ? new Date() : null,
        errorMsg:     errorMsg ?? null,
        entityType:   entityType ?? null,
        entityId:     entityId   ?? null,
        triggeredBy,
      },
    });

    return {
      success,
      mode:      "zapi",
      reference: messageId,
      logId:     log.id,
      error:     errorMsg,
    };
  }

  // ── Modo deep-link (fallback) ─────────────────────────────────────────────
  const deepLink = buildDeepLink(to, body);
  console.log(`[whatsapp] Deep-link gerado → ${to}: ${deepLink}`);

  const log = await prisma.communicationLog.create({
    data: {
      type:         "WHATSAPP_DEEPLINK",
      channel,
      to,
      body,
      status:       "SENT",   // deep-link é "enviado" ao gerar o URL
      attempts:     1,
      lastAttemptAt: new Date(),
      sentAt:       new Date(),
      entityType:   entityType ?? null,
      entityId:     entityId   ?? null,
      triggeredBy,
    },
  });

  return {
    success:   true,
    mode:      "deeplink",
    reference: deepLink,
    logId:     log.id,
  };
}
