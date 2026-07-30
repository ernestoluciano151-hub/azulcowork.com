/**
 * GET /api/admin/documents — lista documentos gerados (paginado + filtros)
 *
 * Query params:
 *   page        — página (default 1)
 *   limit       — por página (default 20, max 50)
 *   entityType  — "LEAD" | "ERPCONTRACT" | "COMPANY"
 *   entityId    — id da entidade
 *   type        — "PROPOSAL" | "CONTRACT" | "DECLARATION" | "LETTER"
 *
 * Permissões: ADMIN, COMERCIAL
 * VOL08 — Sprint VOL08-2B
 */

import { NextRequest, NextResponse }    from "next/server";
import { requireRole }                  from "@/lib/rbac";
import { listGeneratedDocuments }       from "@/lib/document-generation-service";
import type { DocumentTemplateType }    from "@prisma/client";

export async function GET(req: NextRequest) {
  const authErr = await requireRole(req, ["ADMIN", "COMERCIAL"]);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const page       = parseInt(searchParams.get("page")  ?? "1");
  const limit      = parseInt(searchParams.get("limit") ?? "20");
  const entityType = searchParams.get("entityType") ?? undefined;
  const entityId   = searchParams.get("entityId")   ?? undefined;
  const type       = searchParams.get("type")        ?? undefined;

  const result = await listGeneratedDocuments({
    page:  isNaN(page)  ? 1  : page,
    limit: isNaN(limit) ? 20 : limit,
    entityType,
    entityId,
    type: type as DocumentTemplateType | undefined,
  });

  return NextResponse.json(result);
}
