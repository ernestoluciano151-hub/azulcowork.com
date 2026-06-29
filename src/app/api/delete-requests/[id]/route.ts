import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { action, reviewNote } = await req.json();
  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json({ error: "Acção inválida." }, { status: 400 });
  }

  const deleteReq = await prisma.deleteRequest.findUnique({ where: { id: params.id } });
  if (!deleteReq) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  if (action === "APPROVE") {
    // Actually delete the entity
    try {
      switch (deleteReq.entityType) {
        case "lead":
          await prisma.lead.delete({ where: { id: deleteReq.entityId } });
          break;
        case "company":
          await prisma.company.delete({ where: { id: deleteReq.entityId } });
          break;
        case "payment":
          await prisma.payment.delete({ where: { id: deleteReq.entityId } });
          break;
        case "reservation":
          await prisma.reservation.delete({ where: { id: deleteReq.entityId } });
          break;
        case "roomLead":
          await prisma.roomBookingLead.delete({ where: { id: deleteReq.entityId } });
          break;
      }
    } catch {
      // Entity may already be deleted
    }
  }

  const updated = await prisma.deleteRequest.update({
    where: { id: params.id },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      reviewedBy: session.sub,
      reviewNote: reviewNote || null,
      updatedAt: new Date(),
    },
  });
  return NextResponse.json({ request: updated });
}
