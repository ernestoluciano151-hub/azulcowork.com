import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole, CompanyCategory } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { addTimeline } from "@/lib/timeline";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

/**
 * POST /api/atividades/promover  { companyId }
 *
 * Passa uma empresa de SALA_REUNIAO para SALA_PRIVADA (aprovado pelo PO em
 * 06 Out 2026). A partir daqui entra em Atividades (taxa de condomínio, 2h
 * sala, 30 impressões) e nas métricas de contrato/MRR. Renda, plano e datas
 * do contrato devem ser ajustados depois em Editar Empresa.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  try {
    const { companyId } = await req.json();
    if (!companyId || typeof companyId !== "string") {
      return NextResponse.json({ error: "companyId obrigatório." }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, category: true, contractStatus: true, rentAmount: true },
    });
    if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    if (company.category === CompanyCategory.SALA_PRIVADA) {
      return NextResponse.json({ error: "A empresa já é Sala Privada." }, { status: 400 });
    }
    if (company.contractStatus === "ENCERRADO") {
      return NextResponse.json({ error: "Contrato encerrado — reactive a empresa antes de a promover." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: company.id },
        data:  { category: CompanyCategory.SALA_PRIVADA },
      });
      await addTimeline(tx, {
        type:          "NOTA",
        title:         "Empresa passou de Sala de Reunião para Sala Privada",
        description:   "Passa a ter taxa de condomínio e benefícios mensais em Atividades.",
        companyId:     company.id,
        referenceId:   company.id,
        referenceType: "Company",
        createdBy:     session.name || session.email,
      });
    });

    return NextResponse.json({
      ok: true,
      needsRent: company.rentAmount <= 0,
    });
  } catch (err) {
    console.error("[POST /api/atividades/promover]", err);
    Sentry.captureException(err, { tags: { route: "atividades/promover" } });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao promover empresa: ${msg}` }, { status: 500 });
  }
}
