/**
 * /api/erp/payments — Listagem e registo de pagamentos ERP
 *
 * GET  — Lista pagamentos com filtros (todos os roles)
 * POST — Regista novo pagamento em PENDING (ADMIN | FINANCEIRO)
 *
 * Docs: docs/05-erp/payments.md · docs/05-erp/api.md
 */

import { NextRequest, NextResponse }                from "next/server";
import { AdminRole, ErpPaymentMethod, ErpPaymentStatus } from "@prisma/client";
import { requireRole, requireSession }              from "@/lib/auth";
import { isApiRateLimited }                         from "@/lib/rateLimit";
import { registerErpPayment, listErpPayments }      from "@/lib/erp-payment-service";
import "@/lib/bootstrap";

// ── GET /api/erp/payments ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const invoiceId = searchParams.get("invoiceId") ?? undefined;
  const companyId = searchParams.get("companyId") ?? undefined;
  const status    = (searchParams.get("status")   as ErpPaymentStatus) ?? undefined;
  const page      = parseInt(searchParams.get("page")     ?? "1",  10);
  const pageSize  = parseInt(searchParams.get("pageSize") ?? "20", 10);

  try {
    const result = await listErpPayments({ invoiceId, companyId, status, page, pageSize });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/erp/payments]", err);
    return NextResponse.json({ error: "Erro ao listar pagamentos." }, { status: 500 });
  }
}

// ── POST /api/erp/payments ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "erp-payments")) {
    return NextResponse.json({ error: "Demasiadas tentativas. Aguarde." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Corpo inválido." }, { status: 400 }); }

  // Validação
  const { invoiceId, amount, method, paidAt } = body;
  if (!invoiceId || typeof invoiceId !== "string") {
    return NextResponse.json({ error: "invoiceId é obrigatório." }, { status: 400 });
  }
  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "amount deve ser um número positivo (AOA)." }, { status: 400 });
  }
  if (!method || !Object.values(ErpPaymentMethod).includes(method as ErpPaymentMethod)) {
    return NextResponse.json({ error: `method inválido. Valores: ${Object.values(ErpPaymentMethod).join(", ")}` }, { status: 400 });
  }
  if (!paidAt || typeof paidAt !== "string") {
    return NextResponse.json({ error: "paidAt é obrigatório (ISO 8601)." }, { status: 400 });
  }

  try {
    const payment = await registerErpPayment(
      {
        invoiceId,
        amount,
        method:    method as ErpPaymentMethod,
        reference: typeof body.reference === "string" ? body.reference : undefined,
        paidAt:    new Date(paidAt),
        notes:     typeof body.notes === "string" ? body.notes : undefined,
      },
      session!.sub
    );
    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    console.error("[POST /api/erp/payments]", err);
    const msg = err instanceof Error ? err.message : "Erro ao registar pagamento.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
