import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/employees?companyId=xxx
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const companyId = new URL(req.url).searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId obrigatório." }, { status: 400 });

  const employees = await prisma.employee.findMany({
    where: { companyId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ employees });
}

// POST /api/employees
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const { companyId, name, role, department, phone, email, startDate, status, notes } = body;

  if (!companyId || !name || !role) {
    return NextResponse.json({ error: "companyId, nome e cargo são obrigatórios." }, { status: 400 });
  }

  const employee = await prisma.employee.create({
    data: {
      companyId,
      name,
      role,
      department: department || null,
      phone:      phone      || null,
      email:      email      || null,
      startDate:  startDate  ? new Date(startDate) : null,
      status:     status     || "ATIVO",
      notes:      notes      || null,
    },
  });

  return NextResponse.json({ employee }, { status: 201 });
}
