import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import ExcelJS from "exceljs";

const STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo",
  CONTACTADO: "Contactado",
  EM_NEGOCIACAO: "Em negociação",
  CONVERTIDO: "Convertido",
  PERDIDO: "Perdido"
};

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;

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

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Leads");

  ws.columns = [
    { header: "Nome",                key: "nome",      width: 28 },
    { header: "E-mail",              key: "email",     width: 32 },
    { header: "WhatsApp",            key: "whatsapp",  width: 20 },
    { header: "Empresa",             key: "empresa",   width: 22 },
    { header: "Data Agendada",       key: "data",      width: 24 },
    { header: "Hora",                key: "hora",      width: 10 },
    { header: "Tipo de Agendamento", key: "tipo",      width: 24 },
    { header: "Data de Registo",     key: "registo",   width: 24 },
    { header: "Estado",              key: "estado",    width: 18 },
    { header: "Fonte",               key: "fonte",     width: 16 },
  ];

  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F6FED" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  for (const l of leads) {
    ws.addRow({
      nome:     `${l.firstName} ${l.lastName}`,
      email:    l.email,
      whatsapp: l.whatsapp,
      empresa:  l.company || "",
      data:     l.scheduledDate.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
      hora:     l.appointmentTime || "",
      tipo:     l.appointmentType || "",
      registo:  l.createdAt.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
      estado:   STATUS_LABELS[l.status] || l.status,
      fonte:    l.source || "landing-page",
    });
  }

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.xlsx"`
    }
  });
}
