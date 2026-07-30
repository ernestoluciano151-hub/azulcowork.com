/**
 * POST /api/erp/invoices/:id/send
 * Envia factura por email: ISSUED → SENT.
 *
 * Fluxo:
 *   1. Gera PDF via @react-pdf/renderer
 *   2. Upload ao Cloudinary /invoices/YYYY/MM/
 *   3. Actualiza invoice: status=SENT, sentAt, sentTo, pdfUrl
 *   4. Envia email via nodemailer (SMTP)
 *   5. Publica erp.invoice.sent
 *
 * Requer ADMIN | FINANCEIRO.
 * Requer: invoice.status = ISSUED + company.email definido.
 *
 * Docs: docs/05-erp/communication.md
 */

export const runtime = "nodejs"; // @react-pdf/renderer requer Node.js runtime

import { NextRequest, NextResponse } from "next/server";
import { AdminRole }                 from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { sendInvoice }               from "@/lib/erp-communication-service";
import "@/lib/bootstrap";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  try {
    const result = await sendInvoice(params.id, session!.sub);

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
    const msg = err instanceof Error ? err.message : "Erro ao enviar factura.";

    // 409 para erros de estado
    const isConflict = msg.includes("ISSUED") || msg.includes("email");
    return NextResponse.json({ error: msg }, { status: isConflict ? 409 : 500 });
  }
}
