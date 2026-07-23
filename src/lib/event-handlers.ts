/**
 * Event Handlers — Reações automáticas a eventos do sistema
 *
 * Cada handler subscreve eventos do Event Bus e executa
 * lógica de negócio cross-módulo sem acoplamento direto.
 *
 * Registar uma vez no arranque da aplicação (ver src/lib/bootstrap.ts).
 */

import { subscribe } from "./event-bus";
import { prisma } from "./prisma";
import { addTimeline } from "./timeline";

let initialized = false;

export function registerEventHandlers() {
  if (initialized) return;
  initialized = true;

  // ──────────────────────────────────────────────────────────
  // LEAD CRIADO → notificação
  // ──────────────────────────────────────────────────────────
  subscribe("lead.created", async ({ leadId, firstName, lastName, source }) => {
    await createNotification({
      type: "INFO",
      title: "Novo Lead",
      message: `${firstName} ${lastName} pediu uma visita (${source === "landing-page" ? "site" : source}).`,
      entityId: leadId,
      entityType: "Lead",
      priority: "NORMAL",
    });
  });

  // ──────────────────────────────────────────────────────────
  // LEAD CONVERTIDO → criar entrada no histórico + notificação
  // ──────────────────────────────────────────────────────────
  subscribe("lead.converted", async ({ leadId, companyId, convertedBy }) => {
    if (companyId) {
      await addTimeline({
        companyId,
        type: "CONVERSAO",
        title: "Lead convertido",
        description: `Lead #${leadId} convertido e associado a esta empresa.`,
        createdBy: convertedBy,
      });
    }

    await createNotification({
      type: "INFO",
      title: "Lead Convertido",
      message: `Lead convertido${companyId ? " e associado a uma empresa" : ""}.`,
      entityId: leadId,
      entityType: "Lead",
      companyId,
    });
  });

  // ──────────────────────────────────────────────────────────
  // RESERVA CRIADA → notificação + timeline empresa
  // ──────────────────────────────────────────────────────────
  subscribe("reservation.created", async ({ reservationId, eventName, companyId, responsible, startDatetime, totalAmount }) => {
    if (companyId) {
      await addTimeline({
        companyId,
        type: "RESERVA",
        title: "Reserva de sala criada",
        description: `"${eventName}" agendado para ${new Date(startDatetime).toLocaleDateString("pt-PT")} por ${responsible}. Total: ${(totalAmount ?? 0).toLocaleString("pt-PT")} AOA`,
        referenceId: reservationId,
        referenceType: "Reservation",
        amount: totalAmount ?? 0,
        createdBy: responsible,
      });
    }

    await createNotification({
      type: "INFO",
      title: "Nova Reserva",
      message: `"${eventName}" agendado por ${responsible}.`,
      entityId: reservationId,
      entityType: "Reservation",
      companyId,
    });
  });

  // ──────────────────────────────────────────────────────────
  // RESERVA CANCELADA → notificação
  // ──────────────────────────────────────────────────────────
  subscribe("reservation.cancelled", async ({ reservationId, eventName }) => {
    await createNotification({
      type: "WARNING",
      title: "Reserva Cancelada",
      message: `"${eventName}" foi cancelada.`,
      entityId: reservationId,
      entityType: "Reservation",
    });
  });

  // ──────────────────────────────────────────────────────────
  // RESERVA CONFIRMADA → notificação
  // ──────────────────────────────────────────────────────────
  subscribe("reservation.confirmed", async ({ reservationId, eventName, companyId }) => {
    await createNotification({
      type: "SUCCESS",
      title: "Reserva Confirmada",
      message: `"${eventName}" foi confirmada.`,
      entityId: reservationId,
      entityType: "Reservation",
      companyId,
    });
  });

  // ──────────────────────────────────────────────────────────
  // PAGAMENTO RECEBIDO → notificação + atualizar Company.paymentStatus
  // ──────────────────────────────────────────────────────────
  subscribe("payment.received", async ({ paymentId, companyId, amount, paidDate, receivedBy }) => {
    if (companyId) {
      const overdueCount = await prisma.payment.count({
        where: { companyId, status: "ATRASADO" },
      });
      const pendingCount = await prisma.payment.count({
        where: { companyId, status: { in: ["PENDENTE", "ATRASADO"] } },
      });
      const newStatus = overdueCount > 0 ? "EM_ATRASO" : pendingCount > 0 ? "A_VENCER" : "EM_DIA";
      await prisma.company.update({ where: { id: companyId }, data: { paymentStatus: newStatus } });

      await addTimeline({
        companyId,
        type: "PAGAMENTO",
        title: "Pagamento recebido",
        description: `${(amount ?? 0).toLocaleString("pt-PT")} AOA recebido em ${new Date(paidDate).toLocaleDateString("pt-PT")}`,
        referenceId: paymentId,
        referenceType: "Payment",
        amount: amount ?? 0,
        createdBy: receivedBy,
      });
    }

    await createNotification({
      type: "SUCCESS",
      title: "Pagamento Recebido",
      message: `${(amount ?? 0).toLocaleString("pt-PT")} AOA recebido${companyId ? "" : " (sala)"}.`,
      entityId: paymentId,
      entityType: "Payment",
      companyId,
    });
  });

  // ──────────────────────────────────────────────────────────
  // PAGAMENTO EM ATRASO → notificação urgente
  // ──────────────────────────────────────────────────────────
  subscribe("payment.overdue", async ({ paymentId, companyId, amount, daysOverdue }) => {
    await createNotification({
      type: "ERROR",
      title: "Pagamento em Atraso",
      message: `Pagamento de ${(amount ?? 0).toLocaleString("pt-PT")} AOA em atraso há ${daysOverdue} dia(s).`,
      entityId: paymentId,
      entityType: "Payment",
      companyId,
      priority: "HIGH",
    });
  });

  // ──────────────────────────────────────────────────────────
  // EMPRESA CRIADA → notificação
  // ──────────────────────────────────────────────────────────
  subscribe("company.created", async ({ companyId, name, planType }) => {
    await createNotification({
      type: "INFO",
      title: "Nova Empresa",
      message: `${name} registada com plano ${planType}.`,
      entityId: companyId,
      entityType: "Company",
      companyId,
    });
  });

  // ──────────────────────────────────────────────────────────
  // CONTRATO PRÓXIMO DO FIM → alerta
  // ──────────────────────────────────────────────────────────
  subscribe("company.contractExpiringSoon", async ({ companyId, name, daysLeft }) => {
    await createNotification({
      type: "WARNING",
      title: "Contrato Próximo do Fim",
      message: `Contrato de ${name} expira em ${daysLeft} dia(s).`,
      entityId: companyId,
      entityType: "Company",
      companyId,
      priority: "HIGH",
    });
  });

  // ──────────────────────────────────────────────────────────
  // BENEFÍCIO PRÓXIMO DO LIMITE → alerta
  // ──────────────────────────────────────────────────────────
  subscribe("benefit.nearLimit", async ({ companyId, companyName, benefitType, percentUsed }) => {
    await createNotification({
      type: percentUsed >= 100 ? "ERROR" : "WARNING",
      title: "Benefício Próximo do Limite",
      message: `${companyName}: ${benefitType} está a ${Math.round(percentUsed)}% do limite mensal.`,
      entityId: companyId,
      entityType: "Company",
      companyId,
      priority: percentUsed >= 100 ? "HIGH" : "NORMAL",
    });
  });

  // ──────────────────────────────────────────────────────────
  // COLABORADOR CRIADO → notificação + timeline
  // ──────────────────────────────────────────────────────────
  subscribe("employee.created", async ({ employeeId, companyId, name, role }) => {
    await addTimeline({
      companyId,
      type: "COLABORADOR",
      title: "Novo colaborador",
      description: `${name} adicionado como ${role}.`,
      referenceId: employeeId,
      referenceType: "Employee",
    });

    await createNotification({
      type: "INFO",
      title: "Novo Colaborador",
      message: `${name} (${role}) adicionado.`,
      entityId: employeeId,
      entityType: "Employee",
      companyId,
    });
  });

  // ──────────────────────────────────────────────────────────
  // DESPESA CRIADA → notificação ERP
  // ──────────────────────────────────────────────────────────
  subscribe("expense.created", async ({ expenseId, category, amount, description }) => {
    await createNotification({
      type: "INFO",
      title: "Nova Despesa Registada",
      message: `${description} — ${(amount ?? 0).toLocaleString("pt-PT")} AOA (${category}).`,
      entityId: expenseId,
      entityType: "Expense",
    });
  });

  console.log("[EventBus] Handlers registados com sucesso.");
}

// ─────────────────────────────────────────────
// HELPER: criar notificação in-app
// ─────────────────────────────────────────────

interface NotificationInput {
  type: string;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  companyId?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}

async function createNotification(input: NotificationInput) {
  try {
    await prisma.notification.create({
      data: {
        type:       input.type,
        title:      input.title,
        message:    input.message,
        entityId:   input.entityId   ?? null,
        entityType: input.entityType ?? null,
        companyId:  input.companyId  ?? null,
        priority:   input.priority   ?? "NORMAL",
        read:       false,
      },
    });
  } catch {
    // Silenciar erros (ex: migration ainda não aplicada)
  }
}
