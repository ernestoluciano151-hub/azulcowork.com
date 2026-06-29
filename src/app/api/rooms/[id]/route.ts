import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Legacy route — no longer in use
export async function GET() {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

export async function PATCH() {
  return NextResponse.json({ error: "Use /api/plans/[id] instead." }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Use /api/plans/[id] instead." }, { status: 410 });
}
