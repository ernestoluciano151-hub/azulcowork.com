/**
 * /api/erp/contracts — Listagem e criação de contratos ERP
 *
 * GET  — Lista contratos com filtros (todos os roles autenticados)
 * POST — Cria contrato em estado DRAFT (ADMIN | FINANCEIRO)
 *
 * Docs: docs/05-erp/contracts-rent.md · docs/05-erp/api.md
 */

import { NextRequest, NextResponse }    from "next/server";
import { AdminRole }                    from "@prisma/client";
import { requireRole, requireSession }  from "@/lib/auth";
import { isApiRateLimited }             from "@/lib/rateLimit";
import { createErpContract, listErpContracts } from "@/lib/erp-contract-service";
import { ContractPlanType, ContractStatus }    from "@prisma/client";
import "@/lib/bootstrap";

// ── GET /api/erp/contracts ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const companyId = searchParams.get("companyId") ?? undefined;
  const status    = (searchParams.get("status") as ContractStatus) ?? undefined;
  const page      = parseInt(searchParams.get("page")     ?? "1",  10);
  const pageSize  = parseInt(searchParams.get("pageSize") ?? "20", 10);

  try {
    const result = await listErpContracts({ companyId, status, page, pageSize });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/erp/contracts]", err);
    return NextResponse.json({ error: "Erro ao listar contratos." }, { status: 500 });
  }
}

// ── POST /api/erp/contracts ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "erp-contracts")) {
    return NextResponse.json({ error: "Demasiadas tentativas. Aguarde." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Corpo inválido." }, { status: 400 }); }

  // Validação básica
  const { companyId, planType, startDate, monthlyValue } = body;
  if (!companyId || typeof companyId !== "string") {
    return NextResponse.json({ error: "companyId é obrigatório." }, { status: 400 });
  }
  if (!planType || !Object.values(ContractPlanType).includes(planType as ContractPlanType)) {
    return NextResponse.json({ error: `planType inválido. Valores: ${Object.values(ContractPlanType).join(", ")}` }, { status: 400 });
  }
  if (!startDate || typeof startDate !== "string") {
    return NextResponse.json({ error: "startDate é obrigatório (ISO 8601)." }, { status: 400 });
  }
  if (typeof monthlyValue !== "number" || monthlyValue <= 0) {
    return NextResponse.json({ error: "monthlyValue deve ser um número positivo (AOA)." }, { status: 400 });
  }

  try {
    const contract = await createErpContract(
      {
        companyId,
        planType:          planType as ContractPlanType,
        startDate:         new Date(startDate as string),
        endDate:           body.endDate   ? new Date(body.endDate   as string) : undefined,
        monthlyValue,
        depositAmount:     typeof body.depositAmount === "number" ? body.depositAmount : undefined,
        autoRenew:         typeof body.autoRenew === "boolean"   ? body.autoRenew    : false,
        renewalNoticeDays: typeof body.renewalNoticeDays === "number" ? body.renewalNoticeDays : undefined,
        adjustmentRules:   body.adjustmentRules as Record<string, unknown> | undefined,
        notes:             typeof body.notes === "string" ? body.notes : undefined,
        signedAt:          body.signedAt ? new Date(body.signedAt as string) : undefined,
      },
      session!.sub
    );
    return NextResponse.json(contract, { status: 201 });
  } catch (err) {
    console.error("[POST /api/erp/contracts]", err);
    const msg = err instanceof Error ? err.message : "Erro ao criar contrato.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
