/**
 * RBAC — adaptador de compatibilidade (VOL07/VOL08).
 *
 * A implementação real vive em src/lib/auth.ts (SSoT):
 *   requireRole(...roles: AdminRole[]): Promise<AuthResult>
 *
 * Os routes de Comunicação (VOL07) e Gestão Documental (VOL08) usam a
 * convenção `const authErr = await requireRole(req, ["ADMIN"]); if (authErr) return authErr;`
 * Este adaptador converte entre as duas: devolve NextResponse em caso de
 * falha de auth/permissão, ou null em caso de sucesso.
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole } from "@prisma/client";
import { requireRole as requireRoleAuth } from "@/lib/auth";

export async function requireRole(
  _req: NextRequest,
  roles: (AdminRole | "ADMIN" | "COMERCIAL" | "FINANCEIRO" | "VIEWER")[]
): Promise<NextResponse | null> {
  const { error } = await requireRoleAuth(...(roles as AdminRole[]));
  return error;
}
