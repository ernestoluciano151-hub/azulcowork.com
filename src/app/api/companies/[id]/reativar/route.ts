import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { addTimeline } from "@/lib/timeline";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

/** POST /api/companies/[id]/reativar — ENCERRADO → ATIVO (ajustar datas em Editar Empresa). */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  try {
    const company = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true, contractStatus: true } });
    if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    if (company.contractStatus !== "ENCERRADO") {
      return NextResponse.json({ error: "A empresa não está arquivada." }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: company.id }, data: { contractStatus: "ATIVO" } });
      await addTimeline(tx, {
        type: "NOTA",
        title: "Empresa reactivada",
        description: "Contrato reactivado — confirme datas e renda em Editar Empresa. Contratos ERP rescindidos não são reactivados automaticamente.",
        companyId: company.id,
        referenceId: company.id,
        referenceType: "Company",
        createdBy: session.name || session.email,
      });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/companies/:id/reativar]", err);
    Sentry.captureException(err, { tags: { route: "companies/reativar" } });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao reactivar empresa: ${msg}` }, { status: 500 });
  }
}
