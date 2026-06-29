import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Legacy route — no longer in use
export async function GET() {
  return NextResponse.json({ error: "Not found. Use /api/reservations." }, { status: 404 });
}

export async function POST() {
  return NextResponse.json({ error: "Not found. Use /api/reservations." }, { status: 404 });
}
