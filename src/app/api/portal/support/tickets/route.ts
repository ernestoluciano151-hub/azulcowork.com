/**
 * GET  /api/portal/support/tickets  — lista tickets da empresa
 * POST /api/portal/support/tickets  — criar ticket (PORTAL_MEMBER+)
 *
 * Isolamento: companyId obrigatório.
 * Mensagens internas (isInternal=true) NUNCA visíveis no portal.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession, requirePortalRole } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";
import { PortalRole, SupportTicketPriority, SupportTicketStatus } from "@prisma/client";
import { z } from "zod";
import {
  createSupportTicket,
  VALID_TICKET_CATEGORIES,
  type TicketCategory,
} from "@/lib/portal-support-service";

const VALID_STATUSES: SupportTicketStatus[] = [
  SupportTicketStatus.OPEN,
  SupportTicketStatus.IN_PROGRESS,
  SupportTicketStatus.WAITING,
  SupportTicketStatus.RESOLVED,
  SupportTicketStatus.CLOSED,
];

// ── GET — lista tickets ────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { searchParams } = req.nextUrl;
    const status   = searchParams.get("status") as SupportTicketStatus | null;
    const priority = searchParams.get("priority") as SupportTicketPriority | null;

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    const tickets = await prisma.portalSupportTicket.findMany({
      where: {
        companyId: user.companyId,  // isolamento multi-tenant
        ...(status   ? { status }   : {}),
        ...(priority ? { priority } : {}),
      },
      orderBy: [
        { status: "asc" },       // OPEN primeiro
        { priority: "desc" },    // URGENT primeiro dentro do mesmo status
        { createdAt: "desc" },
      ],
      select: {
        id:          true,
        number:      true,
        subject:     true,
        category:    true,
        priority:    true,
        status:      true,
        slaDeadline: true,
        createdAt:   true,
        updatedAt:   true,
        // Contagem de mensagens (sem isInternal)
        _count: {
          select: {
            messages: true,
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ data: tickets });
  } catch (err) {
    console.error("[GET /api/portal/support/tickets]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}

// ── POST — criar ticket ────────────────────────────────────────────────────────

const createSchema = z.object({
  subject:     z.string().min(5).max(120),
  category:    z.enum(VALID_TICKET_CATEGORIES, { errorMap: () => ({ message: "Categoria inválida." }) }),
  priority:    z.enum([
    SupportTicketPriority.LOW,
    SupportTicketPriority.NORMAL,
    SupportTicketPriority.HIGH,
    SupportTicketPriority.URGENT,
  ]).default(SupportTicketPriority.NORMAL),
  description: z.string().min(10).max(5000),
  attachments: z.array(z.string().url()).max(5).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_MEMBER);
    if (error) return error;

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const { subject, category, priority, description, attachments } = parsed.data;

    let ticketId: string;
    try {
      ticketId = await createSupportTicket({
        companyId:     user.companyId,
        createdById:   user.sub,
        createdByName: user.name,
        subject,
        category:      category as TicketCategory,
        priority,
        description,
        attachments,
      });
    } catch (err) {
      console.error("[POST /api/portal/support/tickets] createSupportTicket:", err);
      return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
    }

    const ticket = await prisma.portalSupportTicket.findUnique({
      where:  { id: ticketId },
      select: {
        id:          true,
        number:      true,
        subject:     true,
        category:    true,
        priority:    true,
        status:      true,
        slaDeadline: true,
        createdAt:   true,
      },
    });

    return NextResponse.json({ ok: true, data: ticket }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/portal/support/tickets]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
