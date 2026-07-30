/**
 * /api/crm/companies/:id/tags/:tagId
 *
 * DELETE — Remove associação entre empresa e tag (ADMIN | COMERCIAL)
 *
 * Docs: docs/04-crm/api.md · docs/04-crm/permissions.md
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole }                 from "@prisma/client";
import { requireRole }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string; tagId: string }> };

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { session, error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { id, tagId } = await ctx.params;

  const association = await prisma.companyTag.findUnique({
    where:  { companyId_tagId: { companyId: id, tagId } },
    include: { tag: { select: { name: true } } },
  });
  if (!association) {
    return NextResponse.json({ error: "Associação empresa-tag não encontrada." }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.companyTag.delete({
        where: { companyId_tagId: { companyId: id, tagId } },
      });
      await tx.crmAuditLog.create({
        data: {
          companyId:  id,
          action:     "DELETE",
          entityType: "CompanyTag",
          entityId:   tagId,
          actorId:    session!.sub,
          ip,
          before: { tagId, tagName: association.tag.name },
        },
      });
    });
  } catch (err) {
    console.error("[DELETE /api/crm/companies/:id/tags/:tagId]", err);
    return NextResponse.json({ error: "Erro interno ao remover tag." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
