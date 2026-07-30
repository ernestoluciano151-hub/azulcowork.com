import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

/** Regista um envio de email no CommunicationLog. Fire-and-forget. */
async function logEmail(opts: {
  templateSlug: string;
  to: string;
  subject: string;
  body: string;
  channel: string;
  entityType?: string;
  entityId?: string;
  success: boolean;
  errorMsg?: string;
}) {
  try {
    await prisma.communicationLog.create({
      data: {
        type:         "EMAIL",
        channel:      opts.channel,
        templateSlug: opts.templateSlug,
        to:           opts.to,
        subject:      opts.subject,
        body:         opts.body,
        status:       opts.success ? "SENT" : "FAILED",
        attempts:     1,
        lastAttemptAt: new Date(),
        sentAt:       opts.success ? new Date() : null,
        errorMsg:     opts.errorMsg ?? null,
        entityType:   opts.entityType ?? null,
        entityId:     opts.entityId   ?? null,
        triggeredBy:  "SYSTEM",
      },
    });
  } catch (logErr) {
    console.error("[email] Falha ao registar CommunicationLog:", logErr);
  }
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || "465"),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function isConfigured() {
  const ok = !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.ADMIN_EMAIL);
  if (!ok) {
    console.warn("[email] SMTP não configurado — defina SMTP_USER, SMTP_PASS e ADMIN_EMAIL nas variáveis de ambiente do Vercel.");
  }
  return ok;
}

const baseStyle = "font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:28px;border:1px solid #1e293b";
const rowStyle  = "padding:8px 0;border-bottom:1px solid rgba(30,41,59,0.6)";
const lblStyle  = "color:#94a3b8;width:130px;vertical-align:top;padding:8px 0";
const valStyle  = "color:#f1f5f9;font-weight:500;padding:8px 0 8px 10px";
const btnStyle  = "display:inline-block;margin-top:22px;background:#2F6FED;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px";
const footStyle = "margin-top:20px;font-size:11px;color:#475569";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://azulcowork.com";

// ─── Novo lead coworking ──────────────────────────────────────────────────────
export async function sendNewLeadEmail(lead: {
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  scheduledDate: Date;
  spaceType?: string | null;
  planName?: string | null;
  appointmentType?: string | null;
  source?: string | null;
}) {
  if (!isConfigured()) return;

  const dateStr = lead.scheduledDate.toLocaleString("pt-PT", {
    dateStyle: "full", timeStyle: "short", timeZone: "Africa/Luanda",
  });

  try {
    const subject = `🔔 Novo lead coworking: ${lead.firstName} ${lead.lastName}`;
    const html = `
        <div style="${baseStyle}">
          <h2 style="color:#2F6FED;margin-top:0;font-size:20px">🎉 Novo lead captado — Coworking</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:12px">
            <tr style="${rowStyle}"><td style="${lblStyle}">Nome</td><td style="${valStyle}">${lead.firstName} ${lead.lastName}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">E-mail</td><td style="${valStyle}"><a href="mailto:${lead.email}" style="color:#5C8FFF">${lead.email}</a></td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">WhatsApp</td><td style="${valStyle}"><a href="https://wa.me/${lead.whatsapp.replace(/\D/g,"")}" style="color:#22c55e">${lead.whatsapp}</a></td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Agendamento</td><td style="${valStyle};color:#22c55e">${dateStr}</td></tr>
            ${lead.spaceType ? `<tr style="${rowStyle}"><td style="${lblStyle}">Tipo de espaço</td><td style="${valStyle}">${lead.spaceType}</td></tr>` : ""}
            ${lead.planName ? `<tr style="${rowStyle}"><td style="${lblStyle}">Plano de interesse</td><td style="${valStyle}">${lead.planName}</td></tr>` : ""}
            ${lead.appointmentType ? `<tr style="${rowStyle}"><td style="${lblStyle}">Tipo de contacto</td><td style="${valStyle}">${lead.appointmentType}</td></tr>` : ""}
            <tr style="${rowStyle}"><td style="${lblStyle}">Fonte</td><td style="${valStyle}">${lead.source || "landing-page"}</td></tr>
          </table>
          <a href="${siteUrl()}/admin/leads" style="${btnStyle}">Ver no CRM →</a>
          <p style="${footStyle}">Azul Coworking · Bairro Azul, Edifício 18, Luanda</p>
        </div>
      `;
    await createTransporter().sendMail({
      from: `"Azul Coworking CRM" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject,
      html,
    });
    console.log(`[email] ✓ Notificação coworking enviada — ${lead.firstName} ${lead.lastName}`);
    void logEmail({ templateSlug: "lead-new-coworking", to: process.env.ADMIN_EMAIL!, subject, body: html, channel: "transactional", entityType: "LEAD", success: true });
  } catch (err) {
    console.error("[email] ✗ Erro ao enviar notificação coworking:", err);
    void logEmail({ templateSlug: "lead-new-coworking", to: process.env.ADMIN_EMAIL ?? "unknown", subject: `Novo lead: ${lead.firstName} ${lead.lastName}`, body: "", channel: "transactional", entityType: "LEAD", success: false, errorMsg: String(err) });
  }
}

// ─── Confirmação de reserva de sala (para o cliente) ─────────────────────────
export async function sendReservationConfirmationEmail(data: {
  clientName: string;
  clientEmail: string;
  eventName: string;
  planName: string;
  startDatetime: Date;
  endDatetime: Date;
  totalHours: number;
  coffeeBreak: boolean;
  totalAmount: number;
  reservationId: string;
  invoiceNumber?: string | null;
}) {
  if (!isConfigured()) return;

  const fmtDate = (d: Date) => d.toLocaleString("pt-PT", {
    dateStyle: "full", timeStyle: "short", timeZone: "Africa/Luanda",
  });
  const fmtKz = (v: number) =>
    new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2 }).format(v) + " Kz";

  const subject = `✅ Reserva confirmada — ${data.eventName} | Azul Coworking`;
  const html = `
        <div style="${baseStyle}">
          <h2 style="color:#22c55e;margin-top:0;font-size:20px">✅ Reserva Confirmada!</h2>
          <p style="color:#94a3b8">Olá ${data.clientName}, a sua reserva foi confirmada com sucesso.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px">
            <tr style="${rowStyle}"><td style="${lblStyle}">Evento</td><td style="${valStyle}">${data.eventName}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Plano</td><td style="${valStyle};color:#5C8FFF">${data.planName}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Início</td><td style="${valStyle};color:#22c55e">${fmtDate(data.startDatetime)}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Fim</td><td style="${valStyle}">${fmtDate(data.endDatetime)}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Duração</td><td style="${valStyle}">${data.totalHours}h</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Coffee Break</td><td style="${valStyle}">${data.coffeeBreak ? "☕ Incluído" : "Não incluído"}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Valor total</td><td style="${valStyle};color:#fbbf24;font-weight:700">${fmtKz(data.totalAmount)}</td></tr>
            ${data.invoiceNumber ? `<tr style="${rowStyle}"><td style="${lblStyle}">Nº Fatura</td><td style="${valStyle}">${data.invoiceNumber}</td></tr>` : ""}
          </table>
          <div style="margin-top:16px;padding:14px;background:#0f2a1a;border-radius:8px;border-left:4px solid #22c55e">
            <p style="margin:0;color:#86efac;font-size:13px">📍 <strong>Local:</strong> Azul Coworking — Bairro Azul, Edifício 18, Luanda</p>
            <p style="margin:6px 0 0;color:#94a3b8;font-size:11px">Em caso de dúvidas, entre em contacto via WhatsApp: +244 925 000 000</p>
          </div>
          <p style="${footStyle}">Azul Coworking · Bairro Azul, Edifício 18, Luanda · azulcoworking.ao</p>
        </div>
      `;
  try {
    await createTransporter().sendMail({
      from: `"Azul Coworking" <${process.env.SMTP_USER}>`,
      to: data.clientEmail,
      bcc: process.env.ADMIN_EMAIL,
      subject,
      html,
    });
    console.log(`[email] ✓ Confirmação de reserva enviada — ${data.clientEmail}`);
    void logEmail({ templateSlug: "reservation-confirmation", to: data.clientEmail, subject, body: html, channel: "transactional", entityType: "RESERVATION", entityId: data.reservationId, success: true });
  } catch (err) {
    console.error("[email] ✗ Erro ao enviar confirmação de reserva:", err);
    void logEmail({ templateSlug: "reservation-confirmation", to: data.clientEmail, subject, body: html, channel: "transactional", entityType: "RESERVATION", entityId: data.reservationId, success: false, errorMsg: String(err) });
  }
}

// ─── Notificação admin — nova reserva criada ──────────────────────────────────
export async function sendNewReservationAdminEmail(data: {
  clientName: string;
  clientEmail: string;
  clientWhatsapp?: string | null;
  eventName: string;
  planName: string;
  startDatetime: Date;
  endDatetime: Date;
  totalHours: number;
  coffeeBreak: boolean;
  totalAmount: number;
  reservationId: string;
  status: string;
}) {
  if (!isConfigured()) return;

  const fmtDate = (d: Date) => d.toLocaleString("pt-PT", {
    dateStyle: "full", timeStyle: "short", timeZone: "Africa/Luanda",
  });
  const fmtKz = (v: number) =>
    new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2 }).format(v) + " Kz";

  const subject = `🏨 Nova reserva: ${data.eventName} — ${data.planName}`;
  const html = `
        <div style="${baseStyle}">
          <h2 style="color:#2F6FED;margin-top:0;font-size:20px">🏨 Nova Reserva de Sala</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:12px">
            <tr style="${rowStyle}"><td style="${lblStyle}">Cliente</td><td style="${valStyle}">${data.clientName}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">E-mail</td><td style="${valStyle}"><a href="mailto:${data.clientEmail}" style="color:#5C8FFF">${data.clientEmail}</a></td></tr>
            ${data.clientWhatsapp ? `<tr style="${rowStyle}"><td style="${lblStyle}">WhatsApp</td><td style="${valStyle}"><a href="https://wa.me/${data.clientWhatsapp.replace(/\D/g,"")}" style="color:#22c55e">${data.clientWhatsapp}</a></td></tr>` : ""}
            <tr style="${rowStyle}"><td style="${lblStyle}">Evento</td><td style="${valStyle}">${data.eventName}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Plano</td><td style="${valStyle};color:#5C8FFF">${data.planName}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Início</td><td style="${valStyle};color:#22c55e">${fmtDate(data.startDatetime)}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Fim</td><td style="${valStyle}">${fmtDate(data.endDatetime)}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Duração</td><td style="${valStyle}">${data.totalHours}h</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Coffee Break</td><td style="${valStyle}">${data.coffeeBreak ? "☕ Sim" : "Não"}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Valor</td><td style="${valStyle};color:#fbbf24;font-weight:700">${fmtKz(data.totalAmount)}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Estado</td><td style="${valStyle}">${data.status}</td></tr>
          </table>
          <a href="${siteUrl()}/admin/salas/reserva/${data.reservationId}" style="${btnStyle}">Ver reserva →</a>
          <p style="${footStyle}">Azul Coworking CRM · notificação automática</p>
        </div>
      `;
  try {
    await createTransporter().sendMail({
      from: `"Azul Coworking CRM" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject,
      html,
    });
    console.log(`[email] ✓ Notificação admin reserva enviada — ${data.eventName}`);
    void logEmail({ templateSlug: "reservation-new-admin", to: process.env.ADMIN_EMAIL!, subject, body: html, channel: "transactional", entityType: "RESERVATION", entityId: data.reservationId, success: true });
  } catch (err) {
    console.error("[email] ✗ Erro ao enviar notificação admin reserva:", err);
    void logEmail({ templateSlug: "reservation-new-admin", to: process.env.ADMIN_EMAIL ?? "unknown", subject, body: html, channel: "transactional", entityType: "RESERVATION", entityId: data.reservationId, success: false, errorMsg: String(err) });
  }
}

// ─── Novo pedido de sala de reunião ───────────────────────────────────────────
export async function sendNewRoomLeadEmail(lead: {
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  company?: string | null;
  planName: string;
  participants?: number | null;
  preferredDate?: Date | null;
  preferredTime?: string | null;
  coffeeBreak: boolean;
  observations?: string | null;
}) {
  if (!isConfigured()) return;

  const dateStr = lead.preferredDate
    ? lead.preferredDate.toLocaleDateString("pt-PT", { dateStyle: "full", timeZone: "Africa/Luanda" })
    : "Não especificada";

  const subject = `🏨 Pedido de sala: ${lead.firstName} ${lead.lastName} — Plano ${lead.planName}`;
  const html = `
        <div style="${baseStyle}">
          <h2 style="color:#2F6FED;margin-top:0;font-size:20px">🏨 Novo pedido de reserva — Sala de Reunião</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:12px">
            <tr style="${rowStyle}"><td style="${lblStyle}">Nome</td><td style="${valStyle}">${lead.firstName} ${lead.lastName}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">E-mail</td><td style="${valStyle}"><a href="mailto:${lead.email}" style="color:#5C8FFF">${lead.email}</a></td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">WhatsApp</td><td style="${valStyle}"><a href="https://wa.me/${lead.whatsapp.replace(/\D/g,"")}" style="color:#22c55e">${lead.whatsapp}</a></td></tr>
            ${lead.company ? `<tr style="${rowStyle}"><td style="${lblStyle}">Empresa</td><td style="${valStyle}">${lead.company}</td></tr>` : ""}
            <tr style="${rowStyle}"><td style="${lblStyle}">Plano</td><td style="${valStyle};color:#5C8FFF;font-weight:700">${lead.planName}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Participantes</td><td style="${valStyle}">${lead.participants ?? "Não especificado"}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Data preferida</td><td style="${valStyle};color:#22c55e">${dateStr}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Hora preferida</td><td style="${valStyle}">${lead.preferredTime || "Não especificada"}</td></tr>
            <tr style="${rowStyle}"><td style="${lblStyle}">Coffee Break</td><td style="${valStyle}">${lead.coffeeBreak ? "☕ Sim" : "Não"}</td></tr>
            ${lead.observations ? `<tr style="${rowStyle}"><td style="${lblStyle}">Observações</td><td style="${valStyle};color:#fbbf24">${lead.observations}</td></tr>` : ""}
          </table>
          <a href="${siteUrl()}/admin/leads-salas" style="${btnStyle}">Ver no CRM →</a>
          <p style="${footStyle}">Azul Coworking · Bairro Azul, Edifício 18, Luanda</p>
        </div>
      `;
  try {
    await createTransporter().sendMail({
      from: `"Azul Coworking CRM" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject,
      html,
    });
    console.log(`[email] ✓ Notificação sala enviada — ${lead.firstName} ${lead.lastName}`);
    void logEmail({ templateSlug: "lead-new-sala", to: process.env.ADMIN_EMAIL!, subject, body: html, channel: "transactional", entityType: "LEAD", success: true });
  } catch (err) {
    console.error("[email] ✗ Erro ao enviar notificação sala:", err);
    void logEmail({ templateSlug: "lead-new-sala", to: process.env.ADMIN_EMAIL ?? "unknown", subject, body: html, channel: "transactional", entityType: "LEAD", success: false, errorMsg: String(err) });
  }
}
