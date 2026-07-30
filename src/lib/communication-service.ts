/**
 * communication-service.ts — VOL07
 *
 * Orquestrador central de comunicação do VD Platform.
 *
 * Responsabilidades:
 *   1. Buscar o EmailTemplate por slug
 *   2. Interpolar variáveis no subject e htmlBody
 *   3. Enviar via nodemailer (email.ts transport)
 *   4. Registar o resultado em CommunicationLog (SENT | FAILED)
 *   5. Retry automático para CommunicationLog com status FAILED (máx. 3 tentativas)
 *
 * Graceful degradation:
 *   - Template não encontrado → usa subject/html fornecidos directamente (fallback)
 *   - SMTP não configurado → regista log com status FAILED, não lança
 *   - BD indisponível para log → lança (erro crítico de infra)
 *
 * Nota: este serviço é o único ponto de envio de email externo após VOL07.
 * email.ts e erp-email-service.ts envolvem este serviço.
 */

import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { interpolateEmailTemplate } from "@/lib/template-interpolator";
import type { TemplateVars } from "@/lib/template-interpolator";

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type SendEmailOptions = {
  /** Slug do template em EmailTemplate. Se omitido, usa subject+html directamente. */
  templateSlug?: string;
  /** Destinatário (email) */
  to: string;
  /** BCC opcional (ex: ADMIN_EMAIL) */
  bcc?: string;
  /** Variáveis para interpolação no template */
  vars?: TemplateVars;
  /** Assunto (usado se templateSlug omitido ou template não encontrado) */
  subject?: string;
  /** HTML (usado se templateSlug omitido ou template não encontrado) */
  html?: string;
  /** Canal semântico para log */
  channel: "transactional" | "alert" | "reminder" | "receipt";
  /** Entidade de contexto */
  entityType?: string;
  entityId?: string;
  /** Quem disparou: "SYSTEM" ou ID do admin */
  triggeredBy?: string;
  adminId?: string;
};

export type SendEmailResult = {
  success: boolean;
  logId: string;
  error?: string;
};

// ── Transport nodemailer ───────────────────────────────────────────────────────

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || "smtp.gmail.com",
    port:   parseInt(process.env.SMTP_PORT || "465"),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

const FROM = process.env.SMTP_FROM || `"Azul Coworking" <${process.env.SMTP_USER || "noreply@azulcowork.com"}>`;

// ── Função principal ───────────────────────────────────────────────────────────

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const {
    templateSlug,
    to,
    bcc,
    vars = {},
    channel,
    entityType,
    entityId,
    triggeredBy = "SYSTEM",
    adminId,
  } = opts;

  let subject = opts.subject ?? "(sem assunto)";
  let html    = opts.html    ?? "";

  // 1. Buscar template (se slug fornecido)
  if (templateSlug) {
    try {
      const tpl = await prisma.emailTemplate.findUnique({
        where: { slug: templateSlug },
      });
      if (tpl && tpl.isActive) {
        const interpolated = interpolateEmailTemplate(
          { subject: tpl.subject, htmlBody: tpl.htmlBody },
          vars
        );
        subject = interpolated.subject;
        html    = interpolated.html;
      } else if (tpl && !tpl.isActive) {
        // Template inactivo — usar fallback
        console.warn(`[comm] Template "${templateSlug}" inactivo — usando fallback.`);
      } else {
        console.warn(`[comm] Template "${templateSlug}" não encontrado — usando fallback.`);
      }
    } catch (err) {
      console.error(`[comm] Erro ao buscar template "${templateSlug}":`, err);
    }
  }

  // 2. Criar log inicial (PENDING)
  const log = await prisma.communicationLog.create({
    data: {
      type:         "EMAIL",
      channel,
      templateSlug: templateSlug ?? null,
      to,
      subject,
      body:         html,
      status:       "PENDING",
      attempts:     0,
      entityType:   entityType ?? null,
      entityId:     entityId   ?? null,
      triggeredBy,
      adminId:      adminId    ?? null,
    },
  });

  // 3. Enviar
  if (!isSmtpConfigured()) {
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status:       "FAILED",
        attempts:     1,
        lastAttemptAt: new Date(),
        errorMsg:     "SMTP não configurado (SMTP_USER/SMTP_PASS ausentes)",
      },
    });
    console.warn(`[comm] SMTP não configurado — log criado (FAILED): ${log.id}`);
    return { success: false, logId: log.id, error: "SMTP não configurado" };
  }

  try {
    await createTransport().sendMail({
      from:    FROM,
      to,
      bcc:     bcc || undefined,
      subject,
      html,
    });

    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status:       "SENT",
        attempts:     1,
        lastAttemptAt: new Date(),
        sentAt:       new Date(),
      },
    });

    console.log(`[comm] ✓ Email enviado → ${to} [${templateSlug ?? "direct"}]`);
    return { success: true, logId: log.id };

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status:       "FAILED",
        attempts:     1,
        lastAttemptAt: new Date(),
        errorMsg,
      },
    });

    console.error(`[comm] ✗ Falha ao enviar email → ${to}:`, errorMsg);
    return { success: false, logId: log.id, error: errorMsg };
  }
}

// ── Retry de falhas ────────────────────────────────────────────────────────────

/**
 * Retenta CommunicationLogs com status FAILED, até maxAttempts tentativas.
 * Chamado pelo cron communication-daily.
 */
export async function retryFailedEmails(maxAttempts = 3): Promise<{
  retried: number;
  succeeded: number;
  stillFailing: number;
}> {
  if (!isSmtpConfigured()) {
    return { retried: 0, succeeded: 0, stillFailing: 0 };
  }

  const failed = await prisma.communicationLog.findMany({
    where: {
      status:   "FAILED",
      type:     "EMAIL",
      attempts: { lt: maxAttempts },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let succeeded = 0;
  let stillFailing = 0;

  for (const log of failed) {
    try {
      await prisma.communicationLog.update({
        where: { id: log.id },
        data:  { status: "RETRYING" },
      });

      await createTransport().sendMail({
        from:    FROM,
        to:      log.to,
        subject: log.subject ?? "(sem assunto)",
        html:    log.body,
      });

      await prisma.communicationLog.update({
        where: { id: log.id },
        data: {
          status:       "SENT",
          attempts:     log.attempts + 1,
          lastAttemptAt: new Date(),
          sentAt:       new Date(),
          errorMsg:     null,
        },
      });
      succeeded++;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const nextAttempts = log.attempts + 1;

      await prisma.communicationLog.update({
        where: { id: log.id },
        data: {
          status:       "FAILED",
          attempts:     nextAttempts,
          lastAttemptAt: new Date(),
          errorMsg,
        },
      });
      stillFailing++;
    }
  }

  return { retried: failed.length, succeeded, stillFailing };
}

// ── Log de WhatsApp (deep-link ou API) — regista sem enviar ───────────────────

export async function logWhatsAppDeepLink(opts: {
  to: string;
  body: string;
  channel: "transactional" | "alert" | "reminder" | "receipt";
  entityType?: string;
  entityId?: string;
  triggeredBy?: string;
}): Promise<string> {
  const log = await prisma.communicationLog.create({
    data: {
      type:        "WHATSAPP_DEEPLINK",
      channel:     opts.channel,
      to:          opts.to,
      body:        opts.body,
      status:      "SENT",   // deep-link é "enviado" ao gerar o URL
      attempts:    1,
      sentAt:      new Date(),
      lastAttemptAt: new Date(),
      entityType:  opts.entityType ?? null,
      entityId:    opts.entityId   ?? null,
      triggeredBy: opts.triggeredBy ?? "SYSTEM",
    },
  });
  return log.id;
}
