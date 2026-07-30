/**
 * GET /api/portal/dashboard
 *
 * Dados agregados para o dashboard do cliente:
 * contrato activo, saldo pendente, próxima renda, actividade recente.
 * Acessível a qualquer role (PORTAL_VIEWER incluso).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-auth-service";
import { getPortalDashboard } from "@/lib/portal-dashboard-service";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const data = await getPortalDashboard(user.companyId);
    return NextResponse.json({ data });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "COMPANY_NOT_FOUND") {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    console.error("[GET /api/portal/dashboard]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
