/**
 * Portal Dashboard Service — Volume 03
 *
 * Agrega dados para o dashboard do cliente:
 * - Contrato activo (ErpContract)
 * - Saldo pendente (ErpInvoices em aberto)
 * - Próxima renda (ErpRentSchedule)
 * - Notificações recentes não lidas
 * - Actividade recente (TimelineEntry)
 *
 * Isolamento: TODAS as queries incluem companyId.
 * Performance: queries paralelas via Promise.all().
 */

import { prisma } from "@/lib/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PortalDashboardData {
  company: {
    id:             string;
    name:           string;
    contractStatus: string;
    paymentStatus:  string;
  };
  activeContract: {
    id:           string;
    planType:     string;
    startDate:    Date;
    endDate:      Date | null;
    monthlyValue: number;
    status:       string;
    daysUntilEnd: number | null;
  } | null;
  financials: {
    pendingAmount:    number;  // total em aberto (ErpInvoices não pagas)
    overdueAmount:    number;  // total em atraso
    pendingCount:     number;
    overdueCount:     number;
  };
  nextRent: {
    dueDate:   Date;
    amount:    number;
    status:    string;
    daysUntil: number;
  } | null;
  unreadNotificationsCount: number;
  recentActivity: {
    id:          string;
    eventType:   string;
    title:       string;
    description: string | null;
    occurredAt:  Date;
  }[];
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Agrega todos os dados necessários para o dashboard do portal.
 * Executa queries em paralelo para melhor performance.
 */
export async function getPortalDashboard(companyId: string): Promise<PortalDashboardData> {
  const now = new Date();

  // Queries paralelas — todas filtradas por companyId
  const [
    company,
    activeContract,
    openInvoices,
    nextRent,
    unreadCount,
    recentActivity,
  ] = await Promise.all([
    // 1. Dados básicos da empresa
    prisma.company.findUnique({
      where:  { id: companyId },
      select: { id: true, name: true, contractStatus: true, paymentStatus: true },
    }),

    // 2. Contrato ERP activo
    prisma.erpContract.findFirst({
      where:   { companyId, status: "ACTIVE", deletedAt: null },
      orderBy: { startDate: "desc" },
      select: {
        id:           true,
        planType:     true,
        startDate:    true,
        endDate:      true,
        monthlyValue: true,
        status:       true,
      },
    }),

    // 3. Faturas ERP em aberto (pendentes + em atraso)
    prisma.erpInvoice.findMany({
      where: {
        companyId,
        status: { in: ["ISSUED", "SENT", "OVERDUE", "PARTIALLY_PAID"] },
      },
      select: { total: true, status: true },
    }),

    // 4. Próxima renda pendente
    prisma.erpRentSchedule.findFirst({
      where:   { companyId, status: "PENDING", dueDate: { gte: now } },
      orderBy: { dueDate: "asc" },
      select:  { dueDate: true, amount: true, status: true },
    }),

    // 5. Notificações não lidas do utilizador
    prisma.portalNotification.count({
      where: {
        companyId,
        status: { notIn: ["READ", "FAILED"] },
      },
    }),

    // 6. Actividade recente (últimos 10 eventos da Timeline)
    prisma.timelineEntry.findMany({
      where:   { companyId },
      orderBy: { occurredAt: "desc" },
      take:    10,
      select: {
        id:          true,
        eventType:   true,
        title:       true,
        description: true,
        occurredAt:  true,
      },
    }),
  ]);

  if (!company) {
    throw new Error("COMPANY_NOT_FOUND");
  }

  // Calcular financials
  const pendingInvoices = openInvoices.filter(i => i.status !== "OVERDUE");
  const overdueInvoices = openInvoices.filter(i => i.status === "OVERDUE");

  const financials = {
    pendingAmount: pendingInvoices.reduce((sum, i) => sum + i.total, 0),
    overdueAmount: overdueInvoices.reduce((sum, i) => sum + i.total, 0),
    pendingCount:  pendingInvoices.length,
    overdueCount:  overdueInvoices.length,
  };

  // Calcular dias até fim de contrato
  let activeContractData: PortalDashboardData["activeContract"] = null;
  if (activeContract) {
    const daysUntilEnd = activeContract.endDate
      ? Math.ceil((activeContract.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    activeContractData = {
      id:           activeContract.id,
      planType:     activeContract.planType,
      startDate:    activeContract.startDate,
      endDate:      activeContract.endDate,
      monthlyValue: activeContract.monthlyValue,
      status:       activeContract.status,
      daysUntilEnd,
    };
  }

  // Calcular dias até próxima renda
  let nextRentData: PortalDashboardData["nextRent"] = null;
  if (nextRent) {
    const daysUntil = Math.ceil(
      (nextRent.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    nextRentData = {
      dueDate:   nextRent.dueDate,
      amount:    nextRent.amount,
      status:    nextRent.status,
      daysUntil: Math.max(0, daysUntil),
    };
  }

  return {
    company: {
      id:             company.id,
      name:           company.name,
      contractStatus: company.contractStatus,
      paymentStatus:  company.paymentStatus,
    },
    activeContract:           activeContractData,
    financials,
    nextRent:                 nextRentData,
    unreadNotificationsCount: unreadCount,
    recentActivity:           recentActivity.map(e => ({
      id:          e.id,
      eventType:   e.eventType,
      title:       e.title,
      description: e.description,
      occurredAt:  e.occurredAt,
    })),
  };
}

/**
 * Dados editáveis da empresa (campos que o cliente pode actualizar).
 */
export async function getPortalCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where:  { id: companyId },
    select: {
      id:              true,
      name:            true,
      nif:             true,
      responsible:     true,
      email:           true,
      whatsapp:        true,
      roomNumber:      true,
      numEmployees:    true,
      planType:        true,
      contractStart:   true,
      contractEnd:     true,
      contractStatus:  true,
      paymentStatus:   true,
      billingEmail:    true,
      createdAt:       true,
    },
  });

  if (!company) throw new Error("COMPANY_NOT_FOUND");
  return company;
}

/**
 * Actualiza campos editáveis da empresa pelo cliente.
 * Campos permitidos: whatsapp, billingEmail.
 * Campos protegidos (apenas admin): name, nif, planType, contractStart, contractEnd, etc.
 */
export async function updatePortalCompany(
  companyId: string,
  data: { whatsapp?: string; billingEmail?: string }
) {
  if (Object.keys(data).length === 0) {
    throw new Error("NO_FIELDS_TO_UPDATE");
  }

  return prisma.company.update({
    where:  { id: companyId },
    data,
    select: {
      id:           true,
      whatsapp:     true,
      billingEmail: true,
      updatedAt:    true,
    },
  });
}
