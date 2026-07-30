/**
 * Portal Alerts Service — Volume 03
 *
 * 5 tipos de alertas automáticos omnicanal:
 *
 *   RENT_DUE          — renda a vencer em 7 dias
 *   CONTRACT_EXPIRING — contrato a expirar em 30/15/7 dias
 *   PAYMENT_OVERDUE   — pagamento em atraso (+1 dia, +7 dias, +30 dias)
 *   BOOKING_CONFIRMED — reserva de sala confirmada (triggered event)
 *   DOCUMENT_AVAILABLE — novo documento disponível (triggered event)
 *
 * Cada função verifica a condição, cria PortalNotification(s) via notifyUser()
 * e retorna contagens de alertas criados.
 *
 * Notas de idempotência:
 *   - Cada alerta usa um "deduplicate window" verificado por TimelineEntry recente
 *   - Evita enviar o mesmo alerta duas vezes no mesmo ciclo de cron
 */

import { prisma }        from "@/lib/prisma";
import { notifyUser }    from "@/lib/portal-notification-service";
import {
  PortalAlertType,
  OmnichannelType,
  TimelineEventType,
} from "@prisma/client";

// ── Helpers de formatação AOA ──────────────────────────────────────────────────

function formatAOA(value: number): string {
  return new Intl.NumberFormat("pt-AO", {
    style:    "currency",
    currency: "AOA",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-AO", {
    day: "2-digit", month: "long", year: "numeric",
    timeZone: "Africa/Luanda",
  });
}

// ── 1. RENT_DUE — renda a vencer em 7 dias ───────────────────────────────────

/**
 * Verifica RentSchedules com dueDate a 7 dias e status PENDING.
 * Notifica todos os PORTAL_OWNER e PORTAL_ADMIN da empresa.
 */
export async function checkRentDue(): Promise<{ alerts: number }> {
  const now     = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in6days = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

  // Rendas a vencer em exactamente 7 dias (janela de 24h)
  const due = await prisma.rentSchedule.findMany({
    where: {
      dueDate: { gte: in6days, lte: in7days },
      status:  "PENDING",
    },
    select: {
      id:       true,
      dueDate:  true,
      amount:   true,
      contract: {
        select: {
          id:       true,
          companyId:true,
          company:  { select: { name: true } },
        },
      },
    },
  });

  let alerts = 0;

  for (const rent of due) {
    const companyId = rent.contract.companyId;
    const company   = rent.contract.company;

    // Buscar utilizadores OWNER e ADMIN da empresa
    const users = await prisma.portalUser.findMany({
      where: {
        companyId,
        isActive:  true,
        role:      { in: ["PORTAL_OWNER", "PORTAL_ADMIN"] },
        notifyInApp: true,
      },
      select: { id: true },
    });

    for (const u of users) {
      await notifyUser({
        companyId,
        portalUserId: u.id,
        type:      PortalAlertType.RENT_DUE,
        title:     "Renda a vencer em 7 dias",
        body:      `A renda de ${formatAOA(rent.amount)} da empresa ${company.name} vence em ${formatDate(rent.dueDate)}.`,
        actionUrl: "/portal/pagamentos",
        contractId:rent.contract.id,
      });
      alerts++;
    }
  }

  return { alerts };
}

// ── 2. CONTRACT_EXPIRING — contrato a expirar ─────────────────────────────────

const CONTRACT_ALERT_DAYS = [30, 15, 7] as const;

export async function checkContractExpiring(): Promise<{ alerts: number }> {
  const now = new Date();
  let alerts = 0;

  for (const days of CONTRACT_ALERT_DAYS) {
    const targetDate    = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const windowStart   = new Date(targetDate.getTime() - 12 * 60 * 60 * 1000);
    const windowEnd     = new Date(targetDate.getTime() + 12 * 60 * 60 * 1000);

    const expiring = await prisma.contract.findMany({
      where: {
        endDate: { gte: windowStart, lte: windowEnd },
        status:  "ACTIVE",
      },
      select: {
        id:       true,
        endDate:  true,
        planType: true,
        companyId:true,
        company:  { select: { name: true } },
      },
    });

    for (const contract of expiring) {
      const companyId = contract.companyId;
      const users = await prisma.portalUser.findMany({
        where:  { companyId, isActive: true, role: { in: ["PORTAL_OWNER", "PORTAL_ADMIN"] } },
        select: { id: true },
      });

      for (const u of users) {
        await notifyUser({
          companyId,
          portalUserId: u.id,
          type:      PortalAlertType.CONTRACT_EXPIRING,
          title:     `Contrato expira em ${days} dias`,
          body:      `O seu contrato ${contract.planType} expira em ${formatDate(contract.endDate)}. `
            + `Por favor contacte-nos para renovação.`,
          actionUrl: "/portal/contratos",
          contractId:contract.id,
        });
        alerts++;
      }
    }
  }

  return { alerts };
}

// ── 3. PAYMENT_OVERDUE — pagamento em atraso ──────────────────────────────────

const OVERDUE_ALERT_DAYS = [1, 7, 30] as const;

export async function checkPaymentOverdue(): Promise<{ alerts: number }> {
  const now = new Date();
  let alerts = 0;

  for (const days of OVERDUE_ALERT_DAYS) {
    const cutoff      = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const windowStart = new Date(cutoff.getTime() - 12 * 60 * 60 * 1000);
    const windowEnd   = new Date(cutoff.getTime() + 12 * 60 * 60 * 1000);

    // Faturas OVERDUE cujo dueDate foi há exactamente `days` dias
    const overdue = await prisma.erpInvoice.findMany({
      where: {
        status:  "OVERDUE",
        dueDate: { gte: windowStart, lte: windowEnd },
      },
      select: {
        id:       true,
        number:   true,
        dueDate:  true,
        total:    true,
        companyId:true,
        company:  { select: { name: true } },
      },
    });

    for (const inv of overdue) {
      const companyId = inv.companyId;
      const users = await prisma.portalUser.findMany({
        where:  { companyId, isActive: true, role: { in: ["PORTAL_OWNER", "PORTAL_ADMIN"] } },
        select: { id: true },
      });

      for (const u of users) {
        await notifyUser({
          companyId,
          portalUserId: u.id,
          type:      PortalAlertType.PAYMENT_OVERDUE,
          title:     `Pagamento em atraso há ${days} ${days === 1 ? "dia" : "dias"}`,
          body:      `A fatura ${inv.number} de ${formatAOA(inv.total)} está em atraso desde ${formatDate(inv.dueDate)}. `
            + `Por favor regularize o pagamento para evitar penalizações.`,
          actionUrl: `/portal/faturas`,
          invoiceId: inv.id,
        });
        alerts++;
      }
    }
  }

  return { alerts };
}

// ── 4. BOOKING_CONFIRMED — evento triggerado (não cron) ───────────────────────

/**
 * Notifica o cliente quando uma reserva é confirmada pelo admin.
 * Triggerado pelo event-handler de confirmação de reserva, não por cron.
 */
export async function notifyBookingConfirmed(params: {
  companyId:    string;
  portalUserId: string;
  bookingId:    string;
  eventName:    string;
  startDatetime:Date;
  planName:     string;
  totalAmount:  number;
}): Promise<void> {
  const { companyId, portalUserId, bookingId, eventName, startDatetime, planName, totalAmount } = params;

  await notifyUser({
    companyId,
    portalUserId,
    type:      PortalAlertType.BOOKING_CONFIRMED,
    title:     "Reserva confirmada",
    body:      `A sua reserva "${eventName}" na ${planName} foi confirmada para ${formatDate(startDatetime)}. `
      + `Valor: ${formatAOA(totalAmount)}.`,
    actionUrl: `/portal/reservas`,
    bookingId,
  });
}

// ── 5. DOCUMENT_AVAILABLE — evento triggerado (não cron) ─────────────────────

/**
 * Notifica o cliente quando um novo documento é partilhado.
 * Triggerado pelo upload via /api/portal/documents (POST).
 */
export async function notifyDocumentAvailable(params: {
  companyId:    string;
  documentId:   string;
  documentTitle:string;
  category:     string;
}): Promise<void> {
  const { companyId, documentId, documentTitle, category } = params;

  // Notificar todos os utilizadores activos da empresa
  const users = await prisma.portalUser.findMany({
    where:  { companyId, isActive: true },
    select: { id: true },
  });

  for (const u of users) {
    await notifyUser({
      companyId,
      portalUserId: u.id,
      type:       PortalAlertType.DOCUMENT_AVAILABLE,
      title:      "Novo documento disponível",
      body:       `O documento "${documentTitle}" (${category}) foi partilhado com a sua empresa.`,
      actionUrl:  `/portal/documentos`,
      documentId,
    }).catch(e => console.error("[Portal Alerts] Falha notify DOCUMENT_AVAILABLE:", e));
  }
}
