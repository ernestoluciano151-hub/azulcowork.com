/**
 * POST /api/erp/payments/:id/receipt
 * Gera PDF de recibo e envia por email.
 *
 * Fluxo:
 *   1. Gera PDF de recibo via @react-pdf/renderer
 *   2. Upload ao Cloudinary /receipts/YYYY/MM/
 *   3. Actualiza payment.receiptUrl
 *   4. Envia email de confirmação de pagamento
 *
 * Requer ADMIN | FINANCEIRO.
 * Requer: payment.status = CONFIRMED + receiptNumber definido.
 *
 * Docs: docs/05-erp/communication.md
 */

export const runtime = "nodejs"; // @react-pdf/renderer requer Node.js runtime

import { NextRequest, NextResponse } from "next/server";
import { AdminRole }                 from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { sendReceipt }               from "@/lib/erp-communication-service";
import * as Sentry                   from "@sentry/nextjs";
import "@/lib/bootstrap";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  // Body opcional — { skipEmail: true } gera só o PDF/URL, sem tentar enviar.
  let skipEmail = false;
  try {
    const body = await req.json();
    skipEmail = body?.skipEmail === true;
  } catch { /* body vazio — comportamento por defeito (envia email) */ }

  try {
    const result = await sendReceipt(params.id, { skipEmail });

    return NextResponse.json(
      {
        ok:           true,
        pdfGenerated: result.pdfGenerated,
        pdfUrl:       result.pdfUrl,
        emailSent:    result.emailSent,
        warnings:     result.warnings.length > 0 ? result.warnings : undefined,
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar recibo.";
    const isConflict = msg.includes("receiptNumber") || msg.includes("email");
    // Sem isto o erro nunca chega ao Sentry — ver nota em invoices/[id]/receipt.
    if (!isConflict) {
      Sentry.captureException(err, {
        tags:  { route: "erp/payments/[id]/receipt" },
        extra: { paymentId: params.id, skipEmail },
      });
    }
    return NextResponse.json({ error: msg }, { status: isConflict ? 409 : 500 });
  }
}
