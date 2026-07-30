import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/notifications?unreadOnly=true&limit=30
export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const limit      = Math.min(100, parseInt(searchParams.get("limit") || "30", 10));

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: unreadOnly ? { read: false } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { read: false } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
