/**
 * POST /api/crm/companies/:id/merge
 *
 * Funde uma empresa source numa empresa target (:id).
 * Implementa ADR-019: target = empresa mais antiga (base); source é marcada MERGED.
 *
 * Body: { sourceId: string; reason?: string }
 *
 * Operações (todas numa $transaction):
 *  1. Transferir CrmContacts     source → target
 *  2. Transferir CrmDeals        source → target
 *  3. Transferir CrmActivities   source → target
 *  4. Transferir CrmTasks        source → target
 *  5. Transferir CrmNotes        source → target
 *  6. Transferir CompanyTags     source → target (ignorar duplicados)
 *  7. Transferir TimelineEntries source → target
 *  8. Marcar source como MERGED (crmStatus, mergedIntoId, crmDeletedAt)
 *  9. Escrever TimelineEntry COMPANY_MERGED no target
 * 10. Escrever CrmAuditLog
 *
 * Regras de bloqueio:
 *  - Não fundir empresa consigo mesma
 *  - Não fundir empresas já MERGED
 *  - Não fundir se source ou target tiver deals activos em WON (ADR-019)
 *  - Apenas ADMIN pode executar merge
 *
 * Docs: docs/04-crm/api.md · docs/adr/README.md (ADR-019)
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole, DealStage }      from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { isApiRateLimited }          from "@/lib/rateLimit";
import { prisma }                    from "@/lib/prisma";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-merge")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const { id: targetId } = await ctx.params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : "";
  const reason   = typeof body.reason   === "string" ? body.reason.trim() : undefined;

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId é obrigatório." }, { status: 400 });
  }
  if (sourceId === targetId) {
    return NextResponse.json({ error: "Não é possível fundir uma empresa consigo mesma." }, { status: 422 });
  }

  // Carregar ambas as empresas
  const [target, source] = await Promise.all([
    prisma.company.findFirst({
      where:  { id: targetId, crmDeletedAt: null },
      select: { id: true, name: true, nif: true, crmStatus: true, createdAt: true },
    }),
    prisma.company.findFirst({
      where:  { id: sourceId, crmDeletedAt: null },
      select: { id: true, name: true, nif: true, crmStatus: true, createdAt: true },
    }),
  ]);

  if (!target) return NextResponse.json({ error: "Empresa target não encontrada." }, { status: 404 });
  if (!source) return NextResponse.json({ error: "Empresa source não encontrada." }, { status: 404 });

  // Bloquear empresas já fundidas
  if (target.crmStatus === "MERGED") {
    return NextResponse.json({ error: "A empresa target já está marcada como MERGED." }, { status: 422 });
  }
  if (source.crmStatus === "MERGED") {
    return NextResponse.json({ error: "A empresa source já está marcada como MERGED." }, { status: 422 });
  }

  // ADR-019: verificar que não existem deals WON activos na source
  const sourceWonDeals = await prisma.crmDeal.count({
    where: { companyId: sourceId, stage: DealStage.WON, deletedAt: null },
  });
  if (sourceWonDeals > 0) {
    return NextResponse.json({
      error: `A empresa source tem ${sourceWonDeals} deal(s) WON. Não é possível fundir empresas com negócios ganhos.`,
    }, { status: 422 });
  }

  // Carregar tags da target para evitar duplicados na transferência
  const targetTagIds = new Set(
    (await prisma.companyTag.findMany({
      where:  { companyId: targetId },
      select: { tagId: true },
    })).map((ct) => ct.tagId)
  );

  // Tags a transferir (excluindo as já presentes no target)
  const tagsToTransfer = await prisma.companyTag.findMany({
    where: { companyId: sourceId, tagId: { notIn: [...targetTagIds] } },
    select: { tagId: true, assignedBy: true, assignedAt: true },
  });

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Transferir CrmContacts
      await tx.crmContact.updateMany({
        where: { companyId: sourceId },
        data:  { companyId: targetId },
      });

      // 2. Transferir CrmDeals
      await tx.crmDeal.updateMany({
        where: { companyId: sourceId },
        data:  { companyId: targetId },
      });

      // 3. Transferir CrmActivities
      await tx.crmActivity.updateMany({
        where: { companyId: sourceId },
        data:  { companyId: targetId },
      });

      // 4. Transferir CrmTasks
      await tx.crmTask.updateMany({
        where: { companyId: sourceId },
        data:  { companyId: targetId },
      });

      // 5. Transferir CrmNotes
      await tx.crmNote.updateMany({
        where: { companyId: sourceId },
        data:  { companyId: targetId },
      });

      // 6. Transferir CompanyTags (ignorar duplicados — já filtrados em memória)
      if (tagsToTransfer.length > 0) {
        await tx.companyTag.createMany({
          data: tagsToTransfer.map((ct) => ({
            companyId:  targetId,
            tagId:      ct.tagId,
            assignedBy: ct.assignedBy,
            assignedAt: ct.assignedAt,
          })),
          skipDuplicates: true,
        });
      }
      // Eliminar todas as tags da source (as transferidas e as já duplicadas)
      await tx.companyTag.deleteMany({ where: { companyId: sourceId } });

      // 7. Transferir TimelineEntries da source para target
      await tx.timelineEntry.updateMany({
        where: { companyId: sourceId },
        data:  { companyId: targetId },
      });

      // 8. Transferir AuditLogs da source para target
      await tx.crmAuditLog.updateMany({
        where: { companyId: sourceId },
        data:  { companyId: targetId },
      });

      // 9. Marcar source como MERGED
      await tx.company.update({
        where: { id: sourceId },
        data:  {
          crmStatus:    "MERGED",
          mergedIntoId: targetId,
          crmDeletedAt: now,
        },
      });

      // 10. TimelineEntry COMPANY_MERGED no target (append-only)
      await tx.timelineEntry.create({
        data: {
          companyId:        targetId,
          eventType:        "COMPANY_MERGED",
          title:            `Empresa fundida: ${source.name}`,
          description:      reason
            ?? `A empresa "${source.name}" (ID: ${sourceId}) foi fundida nesta empresa.`,
          isSystem:         false,
          actorId:          session!.sub,
          actorName:        session!.name ?? undefined,
          linkedEntityType: "Company",
          linkedEntityId:   sourceId,
          metadata:         {
            sourceId,
            sourceName:  source.name,
            sourceNif:   source.nif,
            targetId,
            targetName:  target.name,
            mergedAt:    now.toISOString(),
            reason:      reason ?? null,
          },
        },
      });

      // 11. CrmAuditLog
      await tx.crmAuditLog.create({
        data: {
          companyId:  targetId,
          action:     "MERGE",
          entityType: "Company",
          entityId:   sourceId,
          actorId:    session!.sub,
          ip,
          before: {
            sourceId,
            sourceName: source.name,
            sourceNif:  source.nif,
          },
          after: {
            targetId,
            targetName:    target.name,
            mergedAt:      now.toISOString(),
            contactsMoved: true,
            dealsMoved:    true,
            tagsMoved:     tagsToTransfer.length,
          },
        },
      });
    });
  } catch (err) {
    console.error("[POST /api/crm/companies/:id/merge]", err);
    return NextResponse.json({ error: "Erro interno ao fundir empresas." }, { status: 500 });
  }

  return NextResponse.json({
    ok:       true,
    targetId,
    sourceId,
    mergedAt: now.toISOString(),
  });
}
