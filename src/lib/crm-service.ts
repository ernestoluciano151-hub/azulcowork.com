/**
 * crm-service.ts — Serviço de negócio do módulo CRM
 *
 * Regras obrigatórias:
 *  - Toda operação multi-tabela usa prisma.$transaction()
 *  - Eventos são publicados APÓS persistência bem-sucedida
 *  - AuditLog e TimelineEntry são escritas dentro da transacção
 *  - TimelineEntry é NUNCA actualizada ou eliminada (append-only)
 */

import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/event-bus";
import { CreateCompanyInput } from "@/lib/crm-validators";
import { CompanyStatus, PipelineStage, TimelineEventType } from "@prisma/client";

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export type CrmServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

// ── createCompany ─────────────────────────────────────────────────────────────

/**
 * Cria uma empresa no CRM com todas as entidades associadas numa única transacção.
 *
 * Dentro da transacção (atomic):
 *   1. Verificar NIF duplicado (se fornecido)
 *   2. Criar Company com campos CRM
 *   3. Criar CrmContact primário (se dados de contacto fornecidos)
 *   4. Criar TimelineEntry COMPANY_CREATED (append-only)
 *   5. Criar CrmAuditLog
 *
 * Após a transacção (eventos de domínio):
 *   6. Publicar crm.company.created no Event Bus
 */
export async function createCompany(
  input: CreateCompanyInput,
  actorId: string,
  actorName: string | null,
  ip: string
): Promise<CrmServiceResult<{ id: string; name: string }>> {
  // Verificar NIF duplicado antes da transacção (optimistic check)
  if (input.nif) {
    const existing = await prisma.company.findFirst({
      where: { nif: input.nif, crmStatus: { not: "MERGED" } },
      select: { id: true, name: true },
    });
    if (existing) {
      return {
        ok: false,
        status: 409,
        error: `Já existe uma empresa com o NIF ${input.nif} (ID: ${existing.id}).`,
      };
    }
  }

  let company: { id: string; name: string };

  try {
    company = await prisma.$transaction(async (tx) => {
      // 1. Criar Company
      const created = await tx.company.create({
        data: {
          // Campos CRM
          name:          input.name,
          nif:           input.nif,
          email:         input.email ?? "",
          website:       input.website,
          sector:        input.sector,
          country:       input.country ?? "Angola",
          crmStatus:     CompanyStatus.PROSPECT,
          pipelineStage: input.pipelineStage ?? PipelineStage.NEW_LEAD,
          assignedToId:  input.assignedToId,
          // Campos obrigatórios do modelo coworking — valores neutros para leads CRM
          responsible:   actorName ?? actorId,
          whatsapp:      input.phone ?? "",
          roomNumber:    "",
          planType:      "CRM_LEAD",
          contractStart: new Date(),
          contractEnd:   new Date(),
          rentAmount:    0,
          contractStatus: "CRM",
        },
        select: { id: true, name: true },
      });

      // 2. Criar CrmContact primário (se dados fornecidos)
      if (input.contactFirstName && input.contactLastName) {
        await tx.crmContact.create({
          data: {
            companyId: created.id,
            firstName: input.contactFirstName,
            lastName:  input.contactLastName,
            email:     input.contactEmail,
            phone:     input.contactPhone,
            isPrimary: true,
          },
        });
      }

      // 3. Criar TimelineEntry COMPANY_CREATED (append-only)
      await tx.timelineEntry.create({
        data: {
          companyId: created.id,
          eventType: TimelineEventType.COMPANY_CREATED,
          title:     `Empresa adicionada ao CRM`,
          isSystem:  false,
          actorId,
          actorName: actorName ?? undefined,
          occurredAt: new Date(),
          metadata: {
            pipelineStage: input.pipelineStage ?? "NEW_LEAD",
            nif:           input.nif ?? null,
          },
        },
      });

      // 4. Criar CrmAuditLog (append-only)
      await tx.crmAuditLog.create({
        data: {
          companyId:  created.id,
          action:     "CREATE",
          entityType: "Company",
          entityId:   created.id,
          actorId,
          ip,
          after: {
            name:          input.name,
            nif:           input.nif,
            pipelineStage: input.pipelineStage ?? "NEW_LEAD",
            assignedToId:  input.assignedToId,
          },
        },
      });

      return { id: created.id, name: created.name };
    });
  } catch (err) {
    console.error("[crm-service] createCompany error:", err);
    return { ok: false, status: 500, error: "Erro interno ao criar empresa." };
  }

  // 5. Publicar evento de domínio (após persistência bem-sucedida)
  publish("crm.company.created", {
    companyId:     company.id,
    name:          company.name,
    pipelineStage: input.pipelineStage ?? "NEW_LEAD",
    assignedToId:  input.assignedToId,
    actorId,
    actorName:     actorName ?? undefined,
    timestamp:     new Date().toISOString(),
  }).catch((err) => console.error("[crm-service] publish error:", err));

  return { ok: true, data: company };
}

// ── listCompanies ─────────────────────────────────────────────────────────────

export interface ListCompaniesOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  crmStatus?: string;
  pipelineStage?: string;
  assignedToId?: string;
}

export async function listCompanies(opts: ListCompaniesOptions = {}) {
  const page     = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const skip     = (page - 1) * pageSize;

  const where = {
    // Excluir empresas merged e soft-deleted (crmDeletedAt = null → activa no CRM)
    crmStatus:    { not: CompanyStatus.MERGED as CompanyStatus },
    crmDeletedAt: null,
    // Pesquisa por nome (case-insensitive)
    ...(opts.search
      ? { name: { contains: opts.search, mode: "insensitive" as const } }
      : {}),
    // Filtros opcionais
    ...(opts.crmStatus && opts.crmStatus !== "ALL"
      ? { crmStatus: opts.crmStatus as CompanyStatus }
      : {}),
    ...(opts.pipelineStage && opts.pipelineStage !== "ALL"
      ? { pipelineStage: opts.pipelineStage as PipelineStage }
      : {}),
    ...(opts.assignedToId
      ? { assignedToId: opts.assignedToId }
      : {}),
  };

  const [total, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      select: {
        id:            true,
        name:          true,
        nif:           true,
        email:         true,
        crmStatus:     true,
        pipelineStage: true,
        assignedToId:  true,
        sector:        true,
        country:       true,
        createdAt:     true,
        updatedAt:     true,
        crmContacts: {
          where:  { isPrimary: true, deletedAt: null },
          select: { firstName: true, lastName: true, email: true, phone: true },
          take:   1,
        },
        crmDeals: {
          where:  { deletedAt: null, stage: { not: "LOST" } },
          select: { id: true, title: true, stage: true, value: true },
          take:   1,
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            crmTasks: { where: { status: { in: ["PENDING", "IN_PROGRESS"] }, deletedAt: null } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    data: companies,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
