/**
 * notifications.ts — serviço centralizado de notificações
 * Agrupa envio de email + geração de links WhatsApp
 */

import {
  sendReservationConfirmationEmail,
  sendNewReservationAdminEmail,
} from "./email";

// ── WhatsApp deep-link ────────────────────────────────────────────────────────
/**
 * Gera URL de WhatsApp com mensagem pré-preenchida.
 * Abre wa.me na web ou no app. Não envia automaticamente.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${encoded}`;
}

const fmtDate = (iso: string | Date) =>
  new Date(iso).toLocaleString("pt-PT", {
    dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda",
  });

const fmtKz = (v: number) =>
  new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2 }).format(v) + " Kz";

// ── Mensagens WhatsApp pré-definidas ──────────────────────────────────────────
export function buildReservationConfirmationWA(data: {
  clientName: string;
  eventName: string;
  planName: string;
  startDatetime: string | Date;
  endDatetime: string | Date;
  coffeeBreak: boolean;
  totalAmount: number;
  invoiceNumber?: string | null;
}): string {
  return [
    `✅ *Reserva Confirmada — Azul Coworking*`,
    ``,
    `Olá ${data.clientName}! A sua reserva foi confirmada:`,
    ``,
    `📋 *Evento:* ${data.eventName}`,
    `🏠 *Plano:* ${data.planName}`,
    `🕐 *Início:* ${fmtDate(data.startDatetime)}`,
    `🕐 *Fim:* ${fmtDate(data.endDatetime)}`,
    data.coffeeBreak ? `☕ *Coffee Break:* Incluído` : ``,
    `💰 *Valor Total:* ${fmtKz(data.totalAmount)}`,
    data.invoiceNumber ? `📄 *Fatura:* ${data.invoiceNumber}` : ``,
    ``,
    `📍 Bairro Azul, Edifício 18, Luanda`,
    ``,
    `Obrigado por escolher o Azul Coworking! 🚀`,
  ].filter(l => l !== null && l !== undefined).join("\n");
}

export function buildPaymentReceivedWA(data: {
  clientName: string;
  amountPaid: number;
  invoiceNumber?: string | null;
  balance?: number;
}): string {
  const lines = [
    `💳 *Pagamento Recebido — Azul Coworking*`,
    ``,
    `Olá ${data.clientName}! Confirmamos a recepção do seu pagamento:`,
    ``,
    `✅ *Valor recebido:* ${fmtKz(data.amountPaid)}`,
    data.invoiceNumber ? `📄 *Fatura:* ${data.invoiceNumber}` : ``,
  ];
  if (data.balance != null && data.balance > 0) {
    lines.push(`⚠️ *Saldo em dívida:* ${fmtKz(data.balance)}`);
  } else {
    lines.push(`🎉 *Conta liquidada!*`);
  }
  lines.push(``, `Obrigado! Azul Coworking 🔵`);
  return lines.filter(l => l !== null && l !== undefined).join("\n");
}

export function buildReservationReminderWA(data: {
  clientName: string;
  eventName: string;
  startDatetime: string | Date;
  planName: string;
  coffeeBreak: boolean;
}): string {
  return [
    `⏰ *Lembrete de Reserva — Azul Coworking*`,
    ``,
    `Olá ${data.clientName}! Lembramos que tem uma reserva amanhã:`,
    ``,
    `📋 *Evento:* ${data.eventName}`,
    `🏠 *Plano:* ${data.planName}`,
    `🕐 *Data e Hora:* ${fmtDate(data.startDatetime)}`,
    data.coffeeBreak ? `☕ *Coffee Break:* Incluído` : ``,
    ``,
    `📍 Bairro Azul, Edifício 18, Luanda`,
    ``,
    `Até amanhã! Azul Coworking 🔵`,
  ].filter(Boolean).join("\n");
}

// ── Notificações automáticas na criação/confirmação de reserva ────────────────
export async function notifyReservationCreated(data: {
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
  // Notificação para o admin
  await sendNewReservationAdminEmail(data);

  // Se o cliente tiver email, envia confirmação (apenas se status for CONFIRMADA)
  if (data.clientEmail && data.status === "CONFIRMADA") {
    await sendReservationConfirmationEmail({
      ...data,
      invoiceNumber: null,
    });
  }
}

export async function notifyReservationConfirmed(data: {
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
  await sendReservationConfirmationEmail(data);
}
