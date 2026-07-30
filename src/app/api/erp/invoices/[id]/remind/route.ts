/**
 * POST /api/erp/invoices/:id/remind
 * Envia lembrete de vencimento ao cliente (manual).
 *
 * Requer ADMIN | FINANCEIRO.
 * Invoice deve estar ISSUED | SENT | OVERDUE.
 *
 * Docs: docs/05-erp/communication.md
 */

import { NextRequest, NextResponse }  from "next/server";
import { AdminRole }                  from "@prisma/client";
import { requireRole }                from "@/lib/auth";
import { sendPaymentReminder }        from "@/lib/erp-communication-service";
import "@/lib/bootstrap";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  try {
    await sendPaymentReminder(params.id);
    return NextResponse.json({ ok: true, message: "Lembrete enviado com sucesso." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao enviar lembrete.";
    const isConflict = msg.includes("ISSUED") || msg.includes("email");
    return NextResponse.json({ error: msg }, { status: isConflict ? 409 : 500 });
  }
}
