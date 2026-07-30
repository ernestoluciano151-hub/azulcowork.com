import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/notifications/read-all — mark all unread as read
export async function POST() {
  const { error } = await requireSession();
  if (error) return error;

  const result = await prisma.notification.updateMany({
    where: { read: false },
    data:  { read: true, readAt: new Date() },
  });

  return NextResponse.json({ updated: result.count });
}
