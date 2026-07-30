/**
 * /api/erp/invoices — Listagem e criação manual de faturas ERP
 *
 * GET  — Lista faturas com filtros (todos os roles)
 * POST — Cria fatura manual em DRAFT (ADMIN | FINANCEIRO)
 *
 * Nota: faturas automáticas (COWORKING via cron, ROOM via evento) são criadas
 * internamente pelo billing-service sem passar por esta rota.
 *
 * Docs: docs/05-erp/billing.md · docs/05-erp/api.md
 */

import { NextRequest, NextResponse }             from "next/server";
import { AdminRole, ErpInvoiceType, ErpInvoiceStatus } from "@prisma/client";
import { requireRole, requireSession }           from "@/lib/auth";
import { isApiRateLimited }                      from "@/lib/rateLimit";
import { createErpInvoice, listErpInvoices }     from "@/lib/erp-billing-service";
import "@/lib/bootstrap";

// ── GET /api/erp/invoices ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const companyId = searchParams.get("companyId") ?? undefined;
  const status    = (searchParams.get("status")   as ErpInvoiceStatus) ?? undefined;
  const type      = (searchParams.get("type")     as ErpInvoiceType)   ?? undefined;
  const page      = parseInt(searchParams.get("page")     ?? "1",  10);
  const pageSize  = parseInt(searchParams.get("pageSize") ?? "20", 10);

  try {
    const result = await listErpInvoices({ companyId, status, type, page, pageSize });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/erp/invoices]", err);
    return NextResponse.json({ error: "Erro ao listar faturas." }, { status: 500 });
  }
}

// ── POST /api/erp/invoices ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "erp-invoices")) {
    return NextResponse.json({ error: "Demasiadas tentativas. Aguarde." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Corpo inválido." }, { status: 400 }); }

  // Validação
  const { type, items } = body;
  if (!type || !Object.values(ErpInvoiceType).includes(type as ErpInvoiceType)) {
    return NextResponse.json({ error: `type inválido. Valores: ${Object.values(ErpInvoiceType).join(", ")}` }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items deve ser um array não vazio." }, { status: 400 });
  }
  for (const it of items) {
    if (!it.description || typeof it.unitPrice !== "number" || it.unitPrice <= 0) {
      return NextResponse.json(
        { error: "Cada item deve ter: description (string), unitPrice (número > 0)." },
        { status: 400 }
      );
    }
  }

  try {
    const invoice = await createErpInvoice(
      {
        type:        type as ErpInvoiceType,
        companyId:   typeof body.companyId === "string"  ? body.companyId   : undefined,
        contractId:  typeof body.contractId === "string" ? body.contractId  : undefined,
        bookingId:   typeof body.bookingId === "string"  ? body.bookingId   : undefined,
        dueDate:     body.dueDate ? new Date(body.dueDate as string) : undefined,
        notes:       typeof body.notes === "string"      ? body.notes       : undefined,
        items:       (items as Array<Record<string, unknown>>).map((it) => ({
          description:  String(it.description),
          quantity:     typeof it.quantity === "number" ? it.quantity : 1,
          unitPrice:    it.unitPrice as number,
          accountCode:  typeof it.accountCode === "string" ? it.accountCode : "",
          costCenterId: typeof it.costCenterId === "string" ? it.costCenterId : undefined,
        })),
      },
      session!.sub
    );
    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    console.error("[POST /api/erp/invoices]", err);
    const msg = err instanceof Error ? err.message : "Erro ao criar fatura.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
