/**
 * /api/crm/companies/[id] — Customer 360°, update e soft-delete
 *
 * GET    — Customer 360°: empresa + contactos + deals + actividades + tasks + timeline
 *          Acesso: ADMIN | COMERCIAL | FINANCEIRO | VIEWER (todos os autenticados)
 *
 * PATCH  — Actualizar campos da empresa
 *          Acesso: ADMIN (qualquer empresa) | COMERCIAL (apenas as suas)
 *          Publica eventos de domínio para alterações de stage, status e owner.
 *
 * DELETE — Soft-delete (crmDeletedAt + CrmAuditLog + TimelineEntry)
 *          Acesso: ADMIN apenas
 *          Rejeita se company tem deals activos (stage não em WON/LOST).
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole, CompanyStatus, PipelineStage, TimelineEventType } from "@prisma/client";
import { requireRole, requireSession }   from "@/lib/auth";
import { isApiRateLimited }              from "@/lib/rateLimit";
import { prisma }                        from "@/lib/prisma";
import { publish }                       from "@/lib/event-bus";
import { sanitizeText, isValidEmail }    from "@/lib/validators";
import "@/lib/bootstrap";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/crm/companies/:id — Customer 360° ───────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await ctx.params;

  const company = await prisma.company.findFirst({
    where: { id, crmDeletedAt: null },
    select: {
      id:            true,
      name:          true,
      nif:           true,
      email:         true,
      website:       true,
      sector:        true,
      country:       true,
      crmStatus:     true,
      pipelineStage: true,
      assignedToId:  true,
      createdAt:     true,
      updatedAt:     true,
      // Contactos (excluir soft-deleted)
      crmContacts: {
        where:   { deletedAt: null },
        select:  { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, isPrimary: true, linkedInUrl: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      // Deals activos (excluir soft-deleted)
      crmDeals: {
        where:   { deletedAt: null },
        select:  { id: true, title: true, stage: true, value: true, currency: true, probability: true, expectedClose: true, assignedToId: true, closedAt: true },
        orderBy: { createdAt: "desc" },
      },
      // Actividades recentes (últimas 10)
      crmActivities: {
        select:  { id: true, type: true, direction: true, title: true, description: true, durationMin: true, createdById: true, occurredAt: true },
        orderBy: { occurredAt: "desc" },
        take:    10,
      },
      // Tasks abertas
      crmTasks: {
        where:   { status: { in: ["PENDING", "IN_PROGRESS"] }, deletedAt: null },
        select:  { id: true, title: true, priority: true, status: true, dueDate: true, assignedToId: true },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      },
      // Notas recentes (últimas 5)
      crmNotes: {
        where:   { deletedAt: null },
        select:  { id: true, content: true, authorId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take:    5,
      },
      // Tags
      companyTags: {
        select: { tag: { select: { id: true, name: true, color: true } }, assignedAt: true },
      },
      // Timeline (últimas 20 entradas)
      crmTimeline: {
        select:  { id: true, eventType: true, title: true, description: true, actorId: true, actorName: true, isSystem: true, linkedEntityType: true, linkedEntityId: true, occurredAt: true, metadata: true },
        orderBy: { occurredAt: "desc" },
        take:    20,
      },
      // Contagens de resumo
      _count: {
        select: {
          crmContacts:  { where: { deletedAt: null } },
          crmDeals:     { where: { deletedAt: null } },
          crmActivities: true,
          crmTasks:     { where: { status: { in: ["PENDING", "IN_PROGRESS"] }, deletedAt: null } },
        },
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ data: company });
}

// ── PATCH /api/crm/companies/:id ─────────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-companies-patch")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const { id } = await ctx.params;

  // Buscar empresa actual
  const existing = await prisma.company.findFirst({
    where: { id, crmDeletedAt: null },
    select: { id: true, name: true, crmStatus: true, pipelineStage: true, assignedToId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  // COMERCIAL só pode editar empresas onde é o responsável
  if (session!.role === AdminRole.COMERCIAL && existing.assignedToId !== session!.sub) {
    return NextResponse.json({ error: "Sem permissão para editar esta empresa." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  // Campos editáveis
  const allowedFields: Record<string, unknown> = {};
  const trackedChanges: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim().length >= 2) {
    allowedFields.name = sanitizeText(body.name.trim());
    trackedChanges.name = allowedFields.name;
  }
  if (typeof body.nif === "string") {
    const nif = body.nif.replace(/\s/g, "");
    if (nif && !/^\d{10}$/.test(nif)) {
      return NextResponse.json({ error: "NIF inválido (10 dígitos)." }, { status: 400 });
    }
    allowedFields.nif = nif || null;
    trackedChanges.nif = allowedFields.nif;
  }
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }
    allowedFields.email = email;
    trackedChanges.email = email;
  }
  if (typeof body.phone    === "string") { allowedFields.whatsapp = sanitizeText(body.phone.trim()); trackedChanges.phone = allowedFields.whatsapp; }
  if (typeof body.website  === "string") { allowedFields.website  = sanitizeText(body.website.trim()); trackedChanges.website = allowedFields.website; }
  if (typeof body.sector   === "string") { allowedFields.sector   = sanitizeText(body.sector.trim()); trackedChanges.sector = allowedFields.sector; }
  if (typeof body.country  === "string") { allowedFields.country  = sanitizeText(body.country.trim()); trackedChanges.country = allowedFields.country; }

  // pipelineStage — dispara evento de mudança de stage
  const newStage = typeof body.pipelineStage === "string" ? body.pipelineStage as PipelineStage : null;
  if (newStage && Object.values(PipelineStage).includes(newStage) && newStage !== existing.pipelineStage) {
    allowedFields.pipelineStage = newStage;
    trackedChanges.pipelineStage = newStage;
  }

  // crmStatus — dispara evento de mudança de status
  const newStatus = typeof body.crmStatus === "string" ? body.crmStatus as CompanyStatus : null;
  if (newStatus && Object.values(CompanyStatus).includes(newStatus) && newStatus !== existing.crmStatus) {
    allowedFields.crmStatus = newStatus;
    trackedChanges.crmStatus = newStatus;
  }

  // assignedToId — apenas ADMIN pode reatribuir
  if (body.assignedToId !== undefined && session!.role === AdminRole.ADMIN) {
    allowedFields.assignedToId = typeof body.assignedToId === "string" ? body.assignedToId : null;
    trackedChanges.assignedToId = allowedFields.assignedToId;
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para actualizar." }, { status: 400 });
  }

  // Actualizar + audit em transacção
  const updatedName = (allowedFields.name as string | undefined) ?? existing.name;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id }, data: allowedFields });

      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "UPDATE",
          entityType: "Company",
          entityId:   id,
          actorId:    session!.sub,
          ip,
          before: {
            name:          existing.name,
            crmStatus:     existing.crmStatus,
            pipelineStage: existing.pipelineStage,
            assignedToId:  existing.assignedToId,
          },
          after: trackedChanges,
        },
      });
    });
  } catch (err) {
    console.error("[PATCH /api/crm/companies/:id]", err);
    return NextResponse.json({ error: "Erro interno ao actualizar empresa." }, { status: 500 });
  }

  // Publicar eventos (após persistência)
  const ts = new Date().toISOString();

  publish("crm.company.updated", { companyId: id, name: updatedName, changes: trackedChanges, actorId: session!.sub, timestamp: ts }).catch(() => {});

  if (newStage && newStage !== existing.pipelineStage) {
    publish("crm.company.stageChanged", {
      companyId: id, name: updatedName,
      previousStage: existing.pipelineStage ?? "unknown",
      newStage, actorId: session!.sub, timestamp: ts,
    }).catch(() => {});
  }

  if (newStatus && newStatus !== existing.crmStatus) {
    publish("crm.company.statusChanged", {
      companyId: id, name: updatedName,
      previousStatus: existing.crmStatus ?? "unknown",
      newStatus, actorId: session!.sub, timestamp: ts,
    }).catch(() => {});
  }

  if (trackedChanges.assignedToId !== undefined && existing.assignedToId !== allowedFields.assignedToId) {
    publish("crm.company.ownerChanged", {
      companyId: id, name: updatedName,
      previousOwnerId: existing.assignedToId ?? undefined,
      newOwnerId: allowedFields.assignedToId as string,
      actorId: session!.sub, timestamp: ts,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/crm/companies/:id — Soft-delete ───────────────────────────────

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const { id } = await ctx.params;
  const ip = _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Verificar existência
  const existing = await prisma.company.findFirst({
    where: { id, crmDeletedAt: null },
    select: {
      id:   true,
      name: true,
      crmDeals: {
        where:  { deletedAt: null, stage: { notIn: ["WON", "LOST"] } },
        select: { id: true, title: true, stage: true },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  // Regra: não pode eliminar se tem deals activos
  if (existing.crmDeals.length > 0) {
    return NextResponse.json({
      error: `Não é possível eliminar uma empresa com ${existing.crmDeals.length} oportunidade(s) activa(s). Feche ou cancele primeiro.`,
      activeDeals: existing.crmDeals.map((d) => ({ id: d.id, title: d.title, stage: d.stage })),
    }, { status: 422 });
  }

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // Soft-delete
      await tx.company.update({
        where: { id },
        data:  { crmDeletedAt: now },
      });

      // Timeline entry (append-only)
      await tx.timelineEntry.create({
        data: {
          companyId:  id,
          eventType:  TimelineEventType.COMPANY_STATUS_CHANGED,
          title:      "Empresa removida do CRM",
          isSystem:   false,
          actorId:    session!.sub,
          actorName:  session!.name ?? undefined,
          occurredAt: now,
          metadata:   { action: "CRM_DELETE" },
        },
      });

      // Audit log
      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "DELETE",
          entityType: "Company",
          entityId:   id,
          actorId:    session!.sub,
          ip,
          before: { name: existing.name, crmDeletedAt: null },
          after:  { crmDeletedAt: now.toISOString() },
        },
      });
    });
  } catch (err) {
    console.error("[DELETE /api/crm/companies/:id]", err);
    return NextResponse.json({ error: "Erro interno ao eliminar empresa." }, { status: 500 });
  }

  publish("crm.company.deleted", {
    companyId: id, name: existing.name, actorId: session!.sub, timestamp: now.toISOString(),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
