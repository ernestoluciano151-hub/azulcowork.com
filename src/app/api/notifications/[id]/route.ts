import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH /api/notifications/:id — mark as read
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const notification = await prisma.notification.update({
    where: { id: params.id },
    data:  { read: true, readAt: new Date() },
  });

  return NextResponse.json({ notification });
}
