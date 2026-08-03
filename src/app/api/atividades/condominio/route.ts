/**
 * POST /api/atividades/condominio
 *
 * Confirma o pagamento da Taxa de Condomínio de uma empresa para um mês
 * (YYYY-MM), reaproveitando o motor financeiro ERP (ver
 * src/lib/condominio-service.ts). Cria automaticamente a fatura ERP
 * (FT-SERV) se ainda não existir, confirma o pagamento e gera o recibo
 * (REC-YYYY-NNNNNN) — tudo visível a partir daí em /admin/erp/*.
 *
 * Requer: ADMIN | FINANCEIRO
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole, ErpPaymentMethod } from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { isApiRateLimited }           from "@/lib/rateLimit";
import { confirmCondominioPayment }   from "@/lib/condominio-service";
import "@/lib/bootstrap";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "atividades-condominio")) {
    return NextResponse.json({ error: "Demasiadas tentativas. Aguarde." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Corpo inválido." }, { status: 400 }); }

  const { companyId, month, method, reference, notes } = body;

  if (!companyId || typeof companyId !== "string") {
    return NextResponse.json({ error: "companyId é obrigatório." }, { status: 400 });
  }
  if (!month || typeof month !== "string" || !MONTH_RE.test(month)) {
    return NextResponse.json({ error: "month inválido (formato esperado: YYYY-MM)." }, { status: 400 });
  }
  if (!method || !Object.values(ErpPaymentMethod).includes(method as ErpPaymentMethod)) {
    return NextResponse.json(
      { error: `method inválido. Valores: ${Object.values(ErpPaymentMethod).join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const { invoice, payment } = await confirmCondominioPayment(
      {
        companyId,
        month,
        method:    method as ErpPaymentMethod,
        reference: typeof reference === "string" ? reference : undefined,
        notes:     typeof notes === "string" ? notes : undefined,
      },
      session!.sub
    );

    return NextResponse.json({
      ok:            true,
      invoiceId:     invoice.id,
      invoiceNumber: invoice.number,
      paymentId:     payment.id,
      receiptNumber: payment.receiptNumber,
      receiptUrl:    payment.receiptUrl,
      amount:        invoice.total,
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/atividades/condominio]", err);
    const msg = err instanceof Error ? err.message : "Erro ao confirmar pagamento.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
