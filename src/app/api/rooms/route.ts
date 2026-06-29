import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Legacy route — redirected to /api/plans
export async function GET() {
  return NextResponse.json({ rooms: [] });
}

export async function POST() {
  return NextResponse.json({ error: "Use /api/plans instead." }, { status: 410 });
}
