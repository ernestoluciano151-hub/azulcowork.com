import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH /api/employees/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  const fields = ["name", "role", "department", "phone", "email", "status", "notes"];
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;

  const employee = await prisma.employee.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ employee });
}

// DELETE /api/employees/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  await prisma.employee.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
