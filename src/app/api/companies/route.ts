import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole, CompanyCategory } from "@prisma/client";
import { requireRole } from "@/lib/auth";

// Placeholder de contrato para empresas SALA_REUNIAO (clientes eventuais,
// pagam por evento, sem mensalidade real). O schema exige estes campos
// (contractStart/contractEnd/roomNumber/rentAmount) para não arriscar
// alterar colunas usadas por relatórios financeiros e alertas — em vez
// disso preenchemos com valores neutros e excluímos esta categoria nos
// pontos que interpretam contrato/facturação (ver companies/alerts,
// finance/summary, atividades).
function roomLeadPlaceholderDefaults() {
  const today = new Date();
  const plus1y = new Date(today);
  plus1y.setFullYear(plus1y.getFullYear() + 1);
  return {
    roomNumber: "—",
    planType: "Sala de Reunião (evento)",
    contractStart: today,
    contractEnd: plus1y,
    rentAmount: 0,
  };
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO);
  if (error) return error;

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
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

  const body = await req.json();
  const {
    name, nif, responsible, email, whatsapp, roomNumber,
    numEmployees, planType, contractStart, contractEnd,
    rentAmount, contractStatus, paymentStatus, contractFileUrl, notes,
    category
  } = body;

  const cat: CompanyCategory =
    category === "SALA_REUNIAO" ? CompanyCategory.SALA_REUNIAO : CompanyCategory.SALA_PRIVADA;
  const isRoomLead = cat === CompanyCategory.SALA_REUNIAO;

  // Campos obrigatórios base — para SALA_PRIVADA mantém-se a exigência total
  // de dados de contrato; para SALA_REUNIAO (cliente eventual) estes campos
  // são preenchidos automaticamente com placeholder, sem bloquear o registo.
  if (!name || !responsible || !email || !whatsapp) {
    return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
  }
  if (!isRoomLead && (!roomNumber || !planType || !contractStart || !contractEnd || !rentAmount)) {
    return NextResponse.json({ error: "Preencha todos os campos obrigatórios do contrato." }, { status: 400 });
  }

  const placeholder = isRoomLead ? roomLeadPlaceholderDefaults() : null;

  const company = await prisma.company.create({
    data: {
      name,
      nif: nif || null,
      responsible,
      email,
      whatsapp,
      category: cat,
      roomNumber: isRoomLead ? placeholder!.roomNumber : roomNumber,
      numEmployees: Number(numEmployees) || 1,
      planType: isRoomLead ? placeholder!.planType : planType,
      contractStart: isRoomLead ? placeholder!.contractStart : new Date(contractStart),
      contractEnd: isRoomLead ? placeholder!.contractEnd : new Date(contractEnd),
      rentAmount: isRoomLead ? placeholder!.rentAmount : Number(rentAmount),
      contractStatus: contractStatus || "ATIVO",
      paymentStatus: paymentStatus || "EM_DIA",
      contractFileUrl: contractFileUrl || null,
      notes: notes || null
    }
  });

  return NextResponse.json({ company }, { status: 201 });
}
