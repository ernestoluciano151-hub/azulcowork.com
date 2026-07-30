/**
 * /api/crm/companies/:id/contacts/:contactId
 *
 * PATCH  — Actualizar contacto (ADMIN | COMERCIAL)
 * DELETE — Soft-delete contacto (ADMIN | COMERCIAL)
 *
 * Regras:
 *  - Não é possível eliminar o único contacto primary se existirem outros
 *    (deve primeiro definir outro como primary)
 *  - Ao fazer PATCH com isPrimary = true, o anterior primary é actualizado
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse }   from "next/server";
import { AdminRole, ContactRole }      from "@prisma/client";
import { requireRole }                 from "@/lib/auth";
import { isApiRateLimited }            from "@/lib/rateLimit";
import { prisma }                      from "@/lib/prisma";
import { publish }                     from "@/lib/event-bus";
import { sanitizeText, isValidEmail }  from "@/lib/validators";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string; contactId: string }> };

const VALID_ROLES = new Set(Object.values(ContactRole));

// ── PATCH /api/crm/companies/:id/contacts/:contactId ─────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-contacts-patch")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const { id, contactId } = await ctx.params;

  const existing = await prisma.crmContact.findFirst({
    where: { id: contactId, companyId: id, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, isPrimary: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Contacto não encontrado." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const tracked: Record<string, unknown> = {};

  if (typeof body.firstName === "string" && body.firstName.trim()) {
    updates.firstName = sanitizeText(body.firstName.trim());
    tracked.firstName = updates.firstName;
  }
  if (typeof body.lastName === "string" && body.lastName.trim()) {
    updates.lastName = sanitizeText(body.lastName.trim());
    tracked.lastName = updates.lastName;
  }
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }
    updates.email = email || null;
    tracked.email = updates.email;
  }
  if (typeof body.phone === "string") {
    updates.phone = sanitizeText(body.phone.trim()) || null;
    tracked.phone = updates.phone;
  }
  if (typeof body.linkedInUrl === "string") {
    updates.linkedInUrl = sanitizeText(body.linkedInUrl.trim()) || null;
    tracked.linkedInUrl = updates.linkedInUrl;
  }
  if (typeof body.notes === "string") {
    updates.notes = sanitizeText(body.notes.trim()) || null;
    tracked.notes = updates.notes;
  }
  if (typeof body.role === "string" && VALID_ROLES.has(body.role as ContactRole)) {
    updates.role = body.role;
    tracked.role = body.role;
  }

  const makePrimary = body.isPrimary === true && !existing.isPrimary;
  if (makePrimary) {
    updates.isPrimary = true;
    tracked.isPrimary = true;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para actualizar." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (makePrimary) {
        await tx.crmContact.updateMany({
          where: { companyId: id, isPrimary: true, deletedAt: null, id: { not: contactId } },
          data:  { isPrimary: false },
        });
      }

      await tx.crmContact.update({ where: { id: contactId }, data: updates });

      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "UPDATE",
          entityType: "CrmContact",
          entityId:   contactId,
          actorId:    session!.sub,
          ip,
          before: { firstName: existing.firstName, lastName: existing.lastName, email: existing.email, role: existing.role, isPrimary: existing.isPrimary },
          after:  tracked,
        },
      });
    });
  } catch (err) {
    console.error("[PATCH /api/crm/companies/:id/contacts/:contactId]", err);
    return NextResponse.json({ error: "Erro interno ao actualizar contacto." }, { status: 500 });
  }

  publish("crm.contact.updated", {
    contactId,
    companyId: id,
    changes:   tracked,
    actorId:   session!.sub,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/crm/companies/:id/contacts/:contactId — Soft-delete ──────────

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { id, contactId } = await ctx.params;

  const existing = await prisma.crmContact.findFirst({
    where:  { id: contactId, companyId: id, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, isPrimary: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Contacto não encontrado." }, { status: 404 });
  }

  // Regra: se é o único primary e existem outros contactos, bloquear
  if (existing.isPrimary) {
    const others = await prisma.crmContact.count({
      where: { companyId: id, deletedAt: null, id: { not: contactId } },
    });
    if (others > 0) {
      return NextResponse.json({
        error: "Não é possível eliminar o contacto principal enquanto existirem outros contactos. Defina primeiro outro contacto como principal.",
      }, { status: 422 });
    }
  }

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.crmContact.update({
        where: { id: contactId },
        data:  { deletedAt: now },
      });

      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "DELETE",
          entityType: "CrmContact",
          entityId:   contactId,
          actorId:    session!.sub,
          ip,
          before: { firstName: existing.firstName, lastName: existing.lastName, isPrimary: existing.isPrimary },
          after:  { deletedAt: now.toISOString() },
        },
      });
    });
  } catch (err) {
    console.error("[DELETE /api/crm/companies/:id/contacts/:contactId]", err);
    return NextResponse.json({ error: "Erro interno ao eliminar contacto." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
