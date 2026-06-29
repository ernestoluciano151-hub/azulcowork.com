import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

const STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo",
  CONTACTADO: "Contactado",
  EM_NEGOCIACAO: "Em negociação",
  CONVERTIDO: "Convertido",
  PERDIDO: "Perdido"
};

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

  const rows = leads.map((l) => ({
    "Nome": `${l.firstName} ${l.lastName}`,
    "E-mail": l.email,
    "WhatsApp": l.whatsapp,
    "Empresa": l.company || "",
    "Data Agendada": l.scheduledDate.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
    "Hora": l.appointmentTime || "",
    "Tipo de Agendamento": l.appointmentType || "",
    "Data de Registo": l.createdAt.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
    "Estado": STATUS_LABELS[l.status] || l.status,
    "Fonte": l.source || "landing-page"
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 20 },
    { wch: 22 }, { wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 15 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Leads");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.xlsx"`
    }
  });
}
