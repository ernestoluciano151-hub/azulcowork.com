/**
 * POST /api/portal/auth/logout
 *
 * Revoga a sessão actual e remove o cookie portal-session.
 */

import { NextRequest, NextResponse } from "next/server";
import { destroyPortalSession } from "@/lib/portal-auth-service";

export async function POST(_req: NextRequest): Promise<NextResponse> {
  try {
    await destroyPortalSession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/portal/auth/logout]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
