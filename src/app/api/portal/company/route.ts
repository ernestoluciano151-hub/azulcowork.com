/**
 * GET  /api/portal/company  — dados da empresa do utilizador autenticado
 * PATCH /api/portal/company  — actualizar campos editáveis (PORTAL_OWNER | PORTAL_ADMIN)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession, requirePortalRole } from "@/lib/portal-auth-service";
import { getPortalCompany, updatePortalCompany } from "@/lib/portal-dashboard-service";
import { PortalRole } from "@prisma/client";
import { z } from "zod";

// GET — qualquer role autenticado
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const company = await getPortalCompany(user.companyId);
    return NextResponse.json({ data: company });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "COMPANY_NOT_FOUND") {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    console.error("[GET /api/portal/company]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}

const patchSchema = z.object({
  whatsapp:     z.string().min(8).max(20).optional(),
  billingEmail: z.string().email("Email de facturação inválido.").max(255).optional(),
});

// PATCH — requer PORTAL_ADMIN ou superior
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_ADMIN);
    if (error) return error;

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "Nenhum campo fornecido." }, { status: 400 });
    }

    const updated = await updatePortalCompany(user.companyId, parsed.data);
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("[PATCH /api/portal/company]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
