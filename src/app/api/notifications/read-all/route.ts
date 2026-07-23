import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/notifications/read-all — mark all unread as read
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const result = await prisma.notification.updateMany({
    where: { read: false },
    data:  { read: true, readAt: new Date() },
  });

  return NextResponse.json({ updated: result.count });
}
