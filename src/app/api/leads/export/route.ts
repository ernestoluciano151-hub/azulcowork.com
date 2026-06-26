import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/leads/export -> exporta todos os leads (respeitando filtros) como CSV
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim();

  const where: any = {};
  if (status && status !== "ALL") where.status = status;
  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
      { whatsapp: { contains: q } }
    ];
  }

  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "desc" } });

  const header = ["Nome", "Email", "WhatsApp", "Data Agendada", "Data de Registo", "Estado"];
  const rows = leads.map((l) => [
    `${l.firstName} ${l.lastName}`,
    l.email,
    l.whatsapp,
    l.scheduledDate.toISOString(),
    l.createdAt.toISOString(),
    l.status
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
