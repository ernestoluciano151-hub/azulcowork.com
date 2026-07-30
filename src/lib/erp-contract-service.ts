/**
 * erp-contract-service.ts — Gestão de contratos de coworking (ERP Volume 02)
 *
 * Operações:
 *  createErpContract    — cria contrato em estado DRAFT
 *  activateErpContract  — DRAFT → ACTIVE + gera ErpRentSchedule[]
 *  suspendErpContract   — ACTIVE → SUSPENDED
 *  reactivateErpContract— SUSPENDED → ACTIVE
 *  terminateErpContract — ACTIVE | SUSPENDED → TERMINATED (cancela parcelas futuras)
 *  listErpContracts     — listagem com filtros
 *  getErpContract       — detalhe com relações
 *
 * Regras:
 *  - Toda mutação em prisma.$transaction()
 *  - Eventos publicados APÓS commit (.catch(() => {}))
 *  - BR-CONT-001: dueDate = dia 1 do mês (mês actual ou seguinte conforme dia de assinatura)
 *  - BR-CONT-002: parcelas OVERDUE definidas pelo cron diário (não aqui)
 *  - Toda activação cria TimelineEntry na Company
 *
 * Docs: docs/05-erp/contracts-rent.md · docs/adr/README.md#adr-022
 */

import { prisma }          from "@/lib/prisma";
import { publish }         from "@/lib/event-bus";
import {
  ContractStatus,
  ContractPlanType,
  DepositStatus,
  RentScheduleStatus,
  TimelineEventType,
} from "@prisma/client";
import { addMonths, startOfMonth, getDate } from "date-fns";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface CreateErpContractInput {
  companyId:         string;
  planType:          ContractPlanType;
  startDate:         Date;
  endDate?:          Date;
  monthlyValue:      number;           // AOA
  depositAmount?:    number;           // AOA — default 0
  autoRenew?:        boolean;
  renewalNoticeDays?: number;
  adjustmentRules?:  Record<string, unknown>;
  notes?:            string;
  signedAt?:         Date;
}

export interface ListErpContractsOptions {
  companyId?: string;
  status?:    ContractStatus;
  page?:      number;
  pageSize?:  number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * BR-CONT-001: primeiro dueDate = dia 1.
 * Se dia da assinatura ≤ 14: dia 1 do mês corrente.
 * Se dia da assinatura ≥ 15: dia 1 do mês seguinte.
 */
function firstDueDate(from: Date): Date {
  const day = getDate(from);
  const base = day <= 14 ? from : addMonths(from, 1);
  return startOfMonth(base);
}

/**
 * Gera array de dueDates mensais (dia 1) desde firstDue até endDate (ou +12 meses).
 */
function generateDueDates(startDate: Date, endDate?: Date): Date[] {
  const first   = firstDueDate(startDate);
  const ceiling = endDate ?? addMonths(startDate, 12);
  const dates: Date[] = [];
  let current = first;
  while (current <= ceiling) {
    dates.push(new Date(current));
    current = addMonths(current, 1);
  }
  return dates;
}

// ── createErpContract ─────────────────────────────────────────────────────────

export async function createErpContract(
  input: CreateErpContractInput,
  actorId: string
) {
  const company = await prisma.company.findUnique({
    where:  { id: input.companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new Error("Empresa não encontrada.");

  const contract = await prisma.$transaction(async (tx) => {
    const c = await tx.erpContract.create({
      data: {
        companyId:         input.companyId,
        planType:          input.planType,
        startDate:         input.startDate,
        endDate:           input.endDate,
        monthlyValue:      input.monthlyValue,
        depositAmount:     input.depositAmount ?? 0,
        depositStatus:     DepositStatus.PENDING,
        autoRenew:         input.autoRenew ?? false,
        renewalNoticeDays: input.renewalNoticeDays ?? 30,
        adjustmentRules:   input.adjustmentRules,
        notes:             input.notes,
        signedAt:          input.signedAt,
        status:            ContractStatus.DRAFT,
        createdBy:         actorId,
      },
    });

    await tx.timelineEntry.create({
      data: {
        companyId:       input.companyId,
        eventType:       TimelineEventType.CONTRACT_ACTIVATED, // reutilizado como CREATED para DRAFT
        title:           "Contrato criado (rascunho)",
        description:     `Plano: ${input.planType} · Kz ${input.monthlyValue.toLocaleString("pt-AO")}/mês`,
        actorId,
        isSystem:        false,
        linkedEntityType: "ErpContract",
        linkedEntityId:  c.id,
        metadata:        { status: "DRAFT", planType: input.planType, monthlyValue: input.monthlyValue },
      },
    });

    return c;
  });

  publish("erp.contract.created", {
    contractId:   contract.id,
    companyId:    company.id,
    companyName:  company.name,
    planType:     input.planType,
    monthlyValue: input.monthlyValue,
    actorId,
    timestamp:    new Date().toISOString(),
  }).catch(() => {});

  return contract;
}

// ── activateErpContract ───────────────────────────────────────────────────────

export async function activateErpContract(contractId: string, actorId: string) {
  const existing = await prisma.erpContract.findUnique({
    where:   { id: contractId },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!existing)                              throw new Error("Contrato não encontrado.");
  if (existing.status !== ContractStatus.DRAFT) throw new Error(`Só contratos DRAFT podem ser activados. Estado actual: ${existing.status}`);

  const dueDates  = generateDueDates(existing.startDate, existing.endDate ?? undefined);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Transição de estado
    const updated = await tx.erpContract.update({
      where: { id: contractId },
      data:  { status: ContractStatus.ACTIVE, updatedBy: actorId },
    });

    // 2. Gerar parcelas mensais
    await tx.erpRentSchedule.createMany({
      data: dueDates.map((dueDate) => ({
        contractId,
        companyId: existing.companyId,
        dueDate,
        amount:    existing.monthlyValue,
        status:    RentScheduleStatus.PENDING,
      })),
    });

    // 3. TimelineEntry
    await tx.timelineEntry.create({
      data: {
        companyId:       existing.companyId,
        eventType:       TimelineEventType.CONTRACT_ACTIVATED,
        title:           "Contrato activado",
        description:     `${dueDates.length} parcelas geradas · Plano: ${existing.planType} · Kz ${existing.monthlyValue.toLocaleString("pt-AO")}/mês`,
        actorId,
        isSystem:        false,
        linkedEntityType: "ErpContract",
        linkedEntityId:  contractId,
        metadata:        {
          planType:           existing.planType,
          monthlyValue:       existing.monthlyValue,
          schedulesGenerated: dueDates.length,
          startDate:          existing.startDate,
          endDate:            existing.endDate,
        },
      },
    });

    return updated;
  });

  publish("erp.contract.activated", {
    contractId,
    companyId:          existing.companyId,
    companyName:        existing.company.name,
    schedulesGenerated: dueDates.length,
    startDate:          existing.startDate.toISOString(),
    endDate:            existing.endDate?.toISOString(),
    actorId,
    timestamp:          new Date().toISOString(),
  }).catch(() => {});

  return result;
}

// ── suspendErpContract ────────────────────────────────────────────────────────

export async function suspendErpContract(
  contractId: string,
  reason: string | undefined,
  actorId: string
) {
  const existing = await prisma.erpContract.findUnique({
    where:   { id: contractId },
    select:  { id: true, status: true, companyId: true },
  });
  if (!existing)                                throw new Error("Contrato não encontrado.");
  if (existing.status !== ContractStatus.ACTIVE) throw new Error(`Só contratos ACTIVE podem ser suspensos. Estado: ${existing.status}`);

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.erpContract.update({
      where: { id: contractId },
      data:  { status: ContractStatus.SUSPENDED, updatedBy: actorId },
    });
    await tx.timelineEntry.create({
      data: {
        companyId:       existing.companyId,
        eventType:       TimelineEventType.CONTRACT_SUSPENDED,
        title:           "Contrato suspenso",
        description:     reason,
        actorId,
        isSystem:        false,
        linkedEntityType: "ErpContract",
        linkedEntityId:  contractId,
        metadata:        { reason },
      },
    });
    return c;
  });

  publish("erp.contract.suspended", {
    contractId, companyId: existing.companyId, reason, actorId,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  return updated;
}

// ── reactivateErpContract ─────────────────────────────────────────────────────

export async function reactivateErpContract(contractId: string, actorId: string) {
  const existing = await prisma.erpContract.findUnique({
    where:  { id: contractId },
    select: { id: true, status: true, companyId: true },
  });
  if (!existing)                                    throw new Error("Contrato não encontrado.");
  if (existing.status !== ContractStatus.SUSPENDED) throw new Error(`Só contratos SUSPENDED podem ser reactivados. Estado: ${existing.status}`);

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.erpContract.update({
      where: { id: contractId },
      data:  { status: ContractStatus.ACTIVE, updatedBy: actorId },
    });
    await tx.timelineEntry.create({
      data: {
        companyId:       existing.companyId,
        eventType:       TimelineEventType.CONTRACT_REACTIVATED,
        title:           "Contrato reactivado",
        actorId,
        isSystem:        false,
        linkedEntityType: "ErpContract",
        linkedEntityId:  contractId,
        metadata:        {},
      },
    });
    return c;
  });

  publish("erp.contract.reactivated", {
    contractId, companyId: existing.companyId, actorId,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  return updated;
}

// ── terminateErpContract ──────────────────────────────────────────────────────

export async function terminateErpContract(
  contractId: string,
  reason: string,
  actorId: string
) {
  const existing = await prisma.erpContract.findUnique({
    where:   { id: contractId },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!existing) throw new Error("Contrato não encontrado.");
  if (
    existing.status !== ContractStatus.ACTIVE &&
    existing.status !== ContractStatus.SUSPENDED
  ) {
    throw new Error(`Só contratos ACTIVE ou SUSPENDED podem ser rescindidos. Estado: ${existing.status}`);
  }

  // Cancelar parcelas PENDING futuras
  const today = new Date();
  const { count: cancelledCount } = await prisma.erpRentSchedule.updateMany({
    where: {
      contractId,
      status:  RentScheduleStatus.PENDING,
      dueDate: { gt: today },
    },
    data: { status: RentScheduleStatus.CANCELLED },
  });

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.erpContract.update({
      where: { id: contractId },
      data:  {
        status:            ContractStatus.TERMINATED,
        terminatedAt:      new Date(),
        terminationReason: reason,
        updatedBy:         actorId,
      },
    });
    await tx.timelineEntry.create({
      data: {
        companyId:       existing.companyId,
        eventType:       TimelineEventType.CONTRACT_TERMINATED,
        title:           "Contrato rescindido",
        description:     reason,
        actorId,
        isSystem:        false,
        linkedEntityType: "ErpContract",
        linkedEntityId:  contractId,
        metadata:        { reason, scheduledCancelled: cancelledCount },
      },
    });
    return c;
  });

  publish("erp.contract.terminated", {
    contractId,
    companyId:          existing.companyId,
    companyName:        existing.company.name,
    reason,
    scheduledCancelled: cancelledCount,
    actorId,
    timestamp:          new Date().toISOString(),
  }).catch(() => {});

  return updated;
}

// ── listErpContracts ──────────────────────────────────────────────────────────

export async function listErpContracts(opts: ListErpContractsOptions = {}) {
  const page     = opts.page     ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const skip     = (page - 1) * pageSize;

  const where = {
    deletedAt: null,
    ...(opts.companyId && { companyId: opts.companyId }),
    ...(opts.status    && { status:    opts.status }),
  };

  const [contracts, total] = await Promise.all([
    prisma.erpContract.findMany({
      where,
      skip,
      take:    pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true, nif: true } },
        _count:  { select: { rentSchedules: true, erpInvoices: true } },
      },
    }),
    prisma.erpContract.count({ where }),
  ]);

  return {
    data:       contracts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ── getErpContract ────────────────────────────────────────────────────────────

export async function getErpContract(contractId: string) {
  return prisma.erpContract.findUnique({
    where:   { id: contractId, deletedAt: null },
    include: {
      company:      { select: { id: true, name: true, nif: true, email: true, billingEmail: true } },
      rentSchedules: { orderBy: { dueDate: "asc" } },
      erpInvoices:   { orderBy: { issueDate: "desc" }, take: 12 },
    },
  });
}
