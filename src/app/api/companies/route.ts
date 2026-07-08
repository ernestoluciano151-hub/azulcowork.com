import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const contractStatus = searchParams.get("contractStatus");
  const paymentStatus = searchParams.get("paymentStatus");
  const q = searchParams.get("q")?.trim();

  const where: any = {};
  if (contractStatus && contractStatus !== "ALL") where.contractStatus = contractStatus;
  if (paymentStatus && paymentStatus !== "ALL") where.paymentStatus = paymentStatus;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { responsible: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } }
    ];
  }

  const rawCompanies = await prisma.company.findMany({
    where,
    orderBy: { contractEnd: "asc" },
    include: {
      payments: { orderBy: { dueDate: "desc" }, take: 5 },
      _count: false,
    }
  });

  const debtMap = await prisma.payment.groupBy({
    by: ["companyId"],
    where: { status: "ATRASADO" },
    _sum: { amount: true },
  });

  const debtByCompany: Record<string, number> = {};
  for (const d of debtMap) {
    if (d.companyId) debtByCompany[d.companyId] = d._sum.amount || 0;
  }

  const companies = rawCompanies.map((c) => ({
    ...c,
    debtAmount: debtByCompany[c.id] || 0,
  }));

  return NextResponse.json({ companies });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const {
    name, nif, responsible, email, whatsapp, roomNumber,
    numEmployees, planType, contractStart, contractEnd,
    rentAmount, contractStatus, paymentStatus, contractFileUrl, notes
  } = body;

  if (!name || !responsible || !email || !whatsapp || !roomNumber || !planType || !contractStart || !contractEnd || !rentAmount) {
    return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
  }

  const company = await prisma.company.create({
    data: {
      name,
      nif: nif || null,
      responsible,
      email,
      whatsapp,
      roomNumber,
      numEmployees: Number(numEmployees) || 1,
      planType,
      contractStart: new Date(contractStart),
      contractEnd: new Date(contractEnd),
      rentAmount: Number(rentAmount),
      contractStatus: contractStatus || "ATIVO",
      paymentStatus: paymentStatus || "EM_DIA",
      contractFileUrl: contractFileUrl || null,
      notes: notes || null
    }
  });

  return NextResponse.json({ company }, { status: 201 });
}
