import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH /api/notifications/:id — mark as read
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession();
  if (error) return error;

  const notification = await prisma.notification.update({
    where: { id: params.id },
    data:  { read: true, readAt: new Date() },
  });

  return NextResponse.json({ notification });
}
