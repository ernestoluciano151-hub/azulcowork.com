/**
 * POST /api/crm/migrate-leads
 *
 * Migra registos da tabela Lead para o módulo CRM (Company + CrmContact).
 * Operação idempotente — pode ser executada múltiplas vezes sem duplicar dados.
 * Apenas ADMIN pode executar.
 *
 * Estratégia (ver docs/04-crm/migration.md):
 *  A) Lead com leadCompanyId → Company já existe:
 *     - Se Company.pipelineStage for null → actualizar para stage mapeado + crmStatus = PROSPECT
 *  B) Lead sem leadCompanyId → criar Company nova:
 *     - Company com campos CRM mínimos
 *     - CrmContact com dados pessoais do Lead
 *     - TimelineEntry COMPANY_CREATED (system)
 *     - Actualizar Lead.leadCompanyId com o novo ID
 *
 * Query params:
 *   dryRun=true — simular sem persistir (default: false)
 *   limit=N     — limitar número de Leads a processar (default: 100, max: 500)
 *
 * Resposta: { processed, created, updated, skipped, errors }
 *
 * Docs: docs/04-crm/migration.md
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole, PipelineStage }  from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import "@/lib/bootstrap";

// ── Mapeamento Lead.status → PipelineStage ───────────────────────────────────

const STATUS_MAP: Record<string, PipelineStage> = {
  NOVO:          PipelineStage.NEW_LEAD,
  NEW:           PipelineStage.NEW_LEAD,
  CONTACTADO:    PipelineStage.CONTACTED,
  CONTACTED:     PipelineStage.CONTACTED,
  QUALIFICADO:   PipelineStage.QUALIFIED,
  QUALIFIED:     PipelineStage.QUALIFIED,
  PROPOSTA:      PipelineStage.PROPOSAL_SENT,
  PROPOSAL:      PipelineStage.PROPOSAL_SENT,
  NEGOCIACAO:    PipelineStage.NEGOTIATION,
  NEGOCIAÇÃO:    PipelineStage.NEGOTIATION,
  NEGOTIATION:   PipelineStage.NEGOTIATION,
  GANHO:         PipelineStage.WON,
  WON:           PipelineStage.WON,
  CONVERTIDO:    PipelineStage.WON,
  CONVERTED:     PipelineStage.WON,
  PERDIDO:       PipelineStage.LOST,
  LOST:          PipelineStage.LOST,
};

function mapStatus(status: string): PipelineStage {
  return STATUS_MAP[status.toUpperCase()] ?? PipelineStage.NEW_LEAD;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const dryRun = searchParams.get("dryRun") === "true";
  const limit  = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10)));

  const actorId   = session!.sub;
  const actorName = session!.name ?? "Sistema";

  // Counters
  let created = 0, updated = 0, skipped = 0;
  const errors: Array<{ leadId: string; reason: string }> = [];

  // Buscar leads não totalmente processados
  // "não processado" = sem leadCompanyId OU company sem pipelineStage
  const leads = await prisma.lead.findMany({
    take: limit,
    orderBy: { createdAt: "asc" },
    select: {
      id:             true,
      firstName:      true,
      lastName:       true,
      email:          true,
      whatsapp:       true,
      company:        true,  // string — nome da empresa
      status:         true,
      source:         true,
      scheduledDate:  true,
      convertedAt:    true,
      leadCompanyId:  true,
      createdAt:      true,
    },
  });

  for (const lead of leads) {
    const targetStage = mapStatus(lead.status);

    try {
      // ── Caso A: Lead já tem Company associada ────────────────────────────────
      if (lead.leadCompanyId) {
        const co = await prisma.company.findUnique({
          where:  { id: lead.leadCompanyId },
          select: { id: true, pipelineStage: true },
        });

        if (!co) {
          errors.push({ leadId: lead.id, reason: "leadCompanyId referencia Company inexistente" });
          continue;
        }

        // Se já tem pipelineStage → já foi migrado, skip
        if (co.pipelineStage !== null) {
          skipped++;
          continue;
        }

        if (!dryRun) {
          await prisma.company.update({
            where: { id: lead.leadCompanyId },
            data:  {
              pipelineStage: targetStage,
              crmStatus:     targetStage === PipelineStage.WON ? "ACTIVE" : "PROSPECT",
            },
          });
        }
        updated++;
        continue;
      }

      // ── Caso B: Lead sem Company associada — criar Company nova ──────────────

      // Determinar nome da empresa
      const companyName = lead.company?.trim()
        || `${lead.firstName} ${lead.lastName}`.trim();

      // Verificar se já existe Company com mesmo nome+email para evitar duplicados
      const existing = await prisma.company.findFirst({
        where: {
          OR: [
            { name: { equals: companyName, mode: "insensitive" } },
          ],
          pipelineStage: { not: null },
        },
        select: { id: true },
      });

      if (existing) {
        // Ligar o Lead à Company existente sem criar outra
        if (!dryRun) {
          await prisma.$transaction(async (tx) => {
            await tx.lead.update({
              where: { id: lead.id },
              data:  { leadCompanyId: existing.id },
            });
            if ((await tx.company.findUnique({ where: { id: existing.id }, select: { pipelineStage: true } }))?.pipelineStage === null) {
              await tx.company.update({
                where: { id: existing.id },
                data:  { pipelineStage: targetStage, crmStatus: "PROSPECT" },
              });
            }
          });
        }
        updated++;
        continue;
      }

      if (!dryRun) {
        await prisma.$transaction(async (tx) => {
          // Criar Company com campos CRM + campos coworking neutros obrigatórios
          const newCompany = await tx.company.create({
            data: {
              name:           companyName,
              responsible:    actorName,
              roomNumber:     "",
              planType:       "CRM_LEAD",
              contractStart:  lead.scheduledDate ?? lead.createdAt,
              contractEnd:    lead.scheduledDate ?? lead.createdAt,
              rentAmount:     0,
              contractStatus: "CRM",
              pipelineStage:  targetStage,
              crmStatus:      targetStage === PipelineStage.WON ? "ACTIVE" : "PROSPECT",
            },
            select: { id: true },
          });

          // Criar CrmContact com dados pessoais do Lead
          await tx.crmContact.create({
            data: {
              companyId: newCompany.id,
              firstName: lead.firstName,
              lastName:  lead.lastName,
              email:     lead.email || undefined,
              phone:     lead.whatsapp || undefined,
              isPrimary: true,
              role:      "OTHER",
            },
          });

          // TimelineEntry system — origem do registo
          await tx.timelineEntry.create({
            data: {
              companyId:  newCompany.id,
              eventType:  "COMPANY_CREATED",
              title:      "Empresa criada por migração de Lead",
              description: `Lead original: ${lead.firstName} ${lead.lastName} (${lead.email ?? "sem email"}) — fonte: ${lead.source ?? "desconhecida"}`,
              isSystem:   true,
              actorId,
              actorName,
              linkedEntityType: "Lead",
              linkedEntityId:   lead.id,
              metadata: {
                migratedFrom: "Lead",
                leadId:       lead.id,
                leadStatus:   lead.status,
                source:       lead.source,
              },
            },
          });

          // Ligar Lead à nova Company
          await tx.lead.update({
            where: { id: lead.id },
            data:  { leadCompanyId: newCompany.id },
          });
        });
      }
      created++;

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ leadId: lead.id, reason: message });
    }
  }

  const processed = created + updated + skipped + errors.length;

  return NextResponse.json({
    ok: true,
    dryRun,
    summary: { processed, created, updated, skipped, errors: errors.length },
    errors:  errors.length > 0 ? errors : undefined,
  });
}
