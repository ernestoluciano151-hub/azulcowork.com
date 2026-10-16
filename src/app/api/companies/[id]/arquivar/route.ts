import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { addTimeline } from "@/lib/timeline";
import { terminateErpContract } from "@/lib/erp-contract-service";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

/**
 * POST /api/companies/[id]/arquivar  { reason?: string, force?: boolean }
 *
 * Arquiva uma empresa cujo contrato não foi renovado: `contractStatus = ENCERRADO`.
 * NADA é apagado — pagamentos, faturas, recibos, histórico e timeline ficam na base
 * de dados (ao contrário de DELETE /api/companies/[id], que faz cascade nos pagamentos).
 * Efeitos: sai de Atividades, alertas, MRR e dívida contratada; contratos ERP activos
 * são rescindidos (cancela rendas futuras pendentes) para não gerar nova facturação.
 * Se houver pagamentos pendentes/em atraso exige `force: true` (confirmação explícita).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    const reason: string = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Contrato não renovado";
    const actor = session.name || session.email;

    const company = await prisma.company.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, contractStatus: true },
    });
    if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    if (company.contractStatus === "ENCERRADO") {
      return NextResponse.json({ error: "A empresa já está arquivada." }, { status: 400 });
    }

    const open = await prisma.payment.aggregate({
      where: { companyId: company.id, status: { in: ["PENDENTE", "ATRASADO"] } },
      _sum: { amount: true },
      _count: { id: true },
    });
    if (open._count.id > 0 && body.force !== true) {
      return NextResponse.json({
        error: "A empresa tem pagamentos pendentes/em atraso.",
        needsConfirm: true,
        openPayments: open._count.id,
        openAmount: open._sum.amount ?? 0,
      }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: company.id }, data: { contractStatus: "ENCERRADO" } });
      await addTimeline(tx, {
        type: "NOTA",
        title: "Empresa arquivada (contrato encerrado)",
        description: `${reason}. Histórico financeiro e documentos mantidos.${open._count.id > 0 ? ` ${open._count.id} pagamento(s) em aberto (${open._sum.amount ?? 0} Kz) mantidos no histórico.` : ""}`,
        companyId: company.id,
        referenceId: company.id,
        referenceType: "Company",
        createdBy: actor,
      });
    });

    // Contratos ERP: rescindir os activos/suspensos; rascunhos → cancelados. Melhor esforço.
    const erpWarnings: string[] = [];
    const contracts = await prisma.erpContract.findMany({
      where: { companyId: company.id, deletedAt: null, status: { in: ["ACTIVE", "SUSPENDED", "DRAFT"] } },
      select: { id: true, status: true },
    });
    for (const c of contracts) {
      try {
        if (c.status === "DRAFT") {
          await prisma.erpContract.update({ where: { id: c.id }, data: { status: "CANCELLED", updatedBy: session.sub } });
        } else {
          await terminateErpContract(c.id, `Empresa arquivada — ${reason}`, session.sub);
        }
      } catch (err) {
        erpWarnings.push(err instanceof Error ? err.message : String(err));
        Sentry.captureException(err, { tags: { route: "companies/arquivar" }, extra: { contractId: c.id } });
      }
    }

    return NextResponse.json({ ok: true, contratosErp: contracts.length, erpWarnings });
  } catch (err) {
    console.error("[POST /api/companies/:id/arquivar]", err);
    Sentry.captureException(err, { tags: { route: "companies/arquivar" } });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao arquivar empresa: ${msg}` }, { status: 500 });
  }
}
