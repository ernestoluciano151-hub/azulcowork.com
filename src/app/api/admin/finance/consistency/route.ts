import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/finance/consistency — SÓ LEITURA (ADMIN | FINANCEIRO).
 * Compara o lado CRM (Company/Payment/Expense) com o lado ERP
 * (ErpContract/ErpPayment/ErpExpense) para medir divergências antes de unificar
 * (Melhoria ERP #1, passo 2 — levantamento).
 */
export async function GET() {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  try {
    const [companies, contracts, crmPaid, erpPaid, expCrm, expErp, expUnsynced] = await Promise.all([
      prisma.company.findMany({
        where: { category: "SALA_PRIVADA", contractStatus: { not: "ENCERRADO" } },
        select: { id: true, name: true, planType: true, rentAmount: true, contractStart: true, contractEnd: true },
        orderBy: { name: "asc" },
      }),
      prisma.erpContract.findMany({
        where: { deletedAt: null, status: { in: ["DRAFT", "ACTIVE", "SUSPENDED"] } },
        select: { id: true, companyId: true, monthlyValue: true, status: true },
      }),
      prisma.payment.groupBy({
        by: ["companyId"],
        where: { status: "PAGO", OR: [{ category: null }, { category: { not: "SALA_REUNIAO" } }] },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.erpPayment.groupBy({
        by: ["companyId"],
        where: { status: "CONFIRMED" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.aggregate({ where: { status: "PAGO" }, _sum: { amount: true }, _count: { id: true } }),
      prisma.erpExpense.aggregate({ where: { status: "PAID", deletedAt: null }, _sum: { amount: true }, _count: { id: true } }),
      prisma.expense.aggregate({ where: { status: "PAGO", erpExpenseId: null }, _sum: { amount: true }, _count: { id: true } }),
    ]);

    const contractsBy = new Map<string, typeof contracts>();
    for (const c of contracts) contractsBy.set(c.companyId, [...(contractsBy.get(c.companyId) ?? []), c]);
    const crmMap = new Map(crmPaid.map((p) => [p.companyId, p]));
    const erpMap = new Map(erpPaid.map((p) => [p.companyId, p]));

    const rows = companies.map((c) => {
      const cs = contractsBy.get(c.id) ?? [];
      const crm = crmMap.get(c.id)?._sum.amount ?? 0;
      const erp = erpMap.get(c.id)?._sum.amount ?? 0;
      const flags: string[] = [];
      if (cs.length === 0) flags.push("SEM_CONTRATO_ERP");
      if (cs.length > 1) flags.push("VARIOS_CONTRATOS_ERP");
      if (cs.length >= 1 && Math.abs(cs[0].monthlyValue - c.rentAmount) > 0.5) flags.push("RENDA_DIFERENTE");
      if (Math.abs(crm - erp) > 0.5) flags.push("PAGAMENTOS_DIFERENTES");
      return {
        companyId: c.id, name: c.name, planType: c.planType,
        rendaCrm: c.rentAmount, rendaErp: cs[0]?.monthlyValue ?? null,
        pagoCrm: crm, pagoErp: erp, flags,
      };
    });

    const count = (f: string) => rows.filter((r) => r.flags.includes(f)).length;
    return NextResponse.json({
      resumo: {
        empresas: rows.length,
        semContratoErp: count("SEM_CONTRATO_ERP"),
        variosContratosErp: count("VARIOS_CONTRATOS_ERP"),
        rendaDiferente: count("RENDA_DIFERENTE"),
        pagamentosDiferentes: count("PAGAMENTOS_DIFERENTES"),
        totalPagoCrm: rows.reduce((s, r) => s + r.pagoCrm, 0),
        totalPagoErp: rows.reduce((s, r) => s + r.pagoErp, 0),
      },
      despesas: {
        pagasCrm: { total: expCrm._sum.amount ?? 0, n: expCrm._count.id },
        pagasErp: { total: expErp._sum.amount ?? 0, n: expErp._count.id },
        porSincronizar: { total: expUnsynced._sum.amount ?? 0, n: expUnsynced._count.id },
      },
      empresas: rows.filter((r) => r.flags.length > 0),
    });
  } catch (err) {
    console.error("[GET /api/admin/finance/consistency]", err);
    Sentry.captureException(err, { tags: { route: "finance/consistency" } });
    return NextResponse.json({ error: "Erro ao calcular consistência financeira." }, { status: 500 });
  }
}
