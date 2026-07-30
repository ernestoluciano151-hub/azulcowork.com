/**
 * /api/crm/companies/:id/contacts
 *
 * GET  — Lista contactos de uma empresa (todos os autenticados)
 * POST — Cria novo contacto (ADMIN | COMERCIAL)
 *
 * Regras:
 *  - Só pode existir um contacto com isPrimary = true por empresa
 *  - Ao criar com isPrimary = true, o anterior primary é actualizado
 *  - Eventos publicados no Event Bus após persistência
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole, ContactRole }    from "@prisma/client";
import { requireSession, requireRole } from "@/lib/auth";
import { isApiRateLimited }          from "@/lib/rateLimit";
import { prisma }                    from "@/lib/prisma";
import { publish }                   from "@/lib/event-bus";
import { sanitizeText, isValidEmail } from "@/lib/validators";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_ROLES = new Set(Object.values(ContactRole));

// ── GET /api/crm/companies/:id/contacts ──────────────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await ctx.params;

  const company = await prisma.company.findFirst({
    where: { id, crmDeletedAt: null },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const contacts = await prisma.crmContact.findMany({
    where:   { companyId: id, deletedAt: null },
    select:  { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, isPrimary: true, linkedInUrl: true, notes: true, createdAt: true, updatedAt: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ data: contacts });
}

// ── POST /api/crm/companies/:id/contacts ─────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "crm-contacts")) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const { id } = await ctx.params;

  const company = await prisma.company.findFirst({
    where: { id, crmDeletedAt: null },
    select: { id: true, name: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }

  // Validação
  const firstName = typeof body.firstName === "string" ? sanitizeText(body.firstName.trim()) : "";
  const lastName  = typeof body.lastName  === "string" ? sanitizeText(body.lastName.trim())  : "";
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "firstName e lastName são obrigatórios." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  const rawRole = typeof body.role === "string" ? body.role : "OTHER";
  const role    = VALID_ROLES.has(rawRole as ContactRole) ? (rawRole as ContactRole) : ContactRole.OTHER;

  const isPrimary = body.isPrimary === true;

  let contact: { id: string; firstName: string; lastName: string };

  try {
    contact = await prisma.$transaction(async (tx) => {
      // Se isPrimary, remover primary anterior
      if (isPrimary) {
        await tx.crmContact.updateMany({
          where: { companyId: id, isPrimary: true, deletedAt: null },
          data:  { isPrimary: false },
        });
      }

      const created = await tx.crmContact.create({
        data: {
          companyId:   id,
          firstName,
          lastName,
          email,
          phone:       typeof body.phone === "string" ? sanitizeText(body.phone.trim()) : undefined,
          role,
          isPrimary,
          linkedInUrl: typeof body.linkedInUrl === "string" ? sanitizeText(body.linkedInUrl.trim()) : undefined,
          notes:       typeof body.notes === "string" ? sanitizeText(body.notes.trim()) : undefined,
        },
        select: { id: true, firstName: true, lastName: true },
      });

      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "CREATE",
          entityType: "CrmContact",
          entityId:   created.id,
          actorId:    session!.sub,
          ip,
          after: { firstName, lastName, email, role, isPrimary },
        },
      });

      return created;
    });
  } catch (err) {
    console.error("[POST /api/crm/companies/:id/contacts]", err);
    return NextResponse.json({ error: "Erro interno ao criar contacto." }, { status: 500 });
  }

  publish("crm.contact.created", {
    contactId:  contact.id,
    companyId:  id,
    firstName:  contact.firstName,
    lastName:   contact.lastName,
    actorId:    session!.sub,
    timestamp:  new Date().toISOString(),
  }).catch(() => {});

  return NextResponse.json({ ok: true, contact }, { status: 201 });
}
