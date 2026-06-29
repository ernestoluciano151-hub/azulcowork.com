import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      payments: { orderBy: { dueDate: "desc" } },
      reservations: { include: { room: true }, orderBy: { startDatetime: "desc" }, take: 10 }
    }
  });

  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  return NextResponse.json({ company });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const data: any = {};

  const fields = [
    "name", "nif", "responsible", "email", "whatsapp", "roomNumber",
    "numEmployees", "planType", "contractStatus", "paymentStatus",
    "contractFileUrl", "notes", "rentAmount"
  ];

  for (const f of fields) {
    if (body[f] !== undefined) {
      if (f === "numEmployees") data[f] = Number(body[f]);
      else if (f === "rentAmount") data[f] = Number(body[f]);
      else data[f] = body[f];
    }
  }

  if (body.contractStart !== undefined) data.contractStart = new Date(body.contractStart);
  if (body.contractEnd !== undefined) data.contractEnd = new Date(body.contractEnd);

  const company = await prisma.company.update({
    where: { id: params.id },
    data
  });

  return NextResponse.json({ company });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  await prisma.company.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
