import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;
  return NextResponse.json(session);
}
