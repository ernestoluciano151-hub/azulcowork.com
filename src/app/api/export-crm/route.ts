import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import ExcelJS from "exceljs";

function headerStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
}

function addSheet(wb: ExcelJS.Workbook, name: string, columns: Partial<ExcelJS.Column>[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns;
  ws.getRow(1).eachCell(headerStyle);
  rows.forEach(r => ws.addRow(r));
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  // Paginated fetch para evitar timeout em BDs grandes
  const [leads, roomLeads, companies, payments, reservations] = await Promise.all([
    prisma.lead.findMany({ include: { notes: true }, orderBy: { createdAt: "desc" }, take: 5000 }),
    prisma.roomBookingLead.findMany({ orderBy: { createdAt: "desc" }, take: 5000 }),
    prisma.company.findMany({ include: { payments: { take: 0 } }, orderBy: { createdAt: "desc" }, take: 2000 }),
    prisma.payment.findMany({ include: { company: { select: { name: true } } }, orderBy: { dueDate: "desc" }, take: 5000 }),
    prisma.reservation.findMany({ include: { plan: { select: { name: true } } }, orderBy: { startDatetime: "desc" }, take: 2000 }),
  ]);

  const wb = new ExcelJS.Workbook();
  const tz = "Africa/Luanda";
  const fmt = (d: Date) => d.toLocaleString("pt-PT", { timeZone: tz });
  const fmtD = (d: Date) => d.toLocaleDateString("pt-PT", { timeZone: tz });

  // ── Folha 1: Leads Coworking ──────────────────────────────────────────────
  addSheet(wb, "Leads Coworking", [
    { header: "Nome",            width: 28 }, { header: "E-mail",         width: 32 },
    { header: "WhatsApp",        width: 20 }, { header: "Empresa",        width: 22 },
    { header: "Tipo de Espaço",  width: 18 }, { header: "Plano",          width: 18 },
    { header: "Data Agendada",   width: 24 }, { header: "Hora",           width: 10 },
    { header: "Tipo Agendamento",width: 22 }, { header: "Estado",         width: 18 },
    { header: "Fonte",           width: 16 }, { header: "Notas",          width: 40 },
    { header: "Registado em",    width: 24 },
  ], leads.map(l => ({
    A: `${l.firstName} ${l.lastName}`, B: l.email, C: l.whatsapp, D: l.company || "",
    E: l.spaceType || "", F: l.planName || "", G: fmt(l.scheduledDate), H: l.appointmentTime || "",
    I: l.appointmentType || "", J: l.status, K: l.source || "landing-page",
    L: l.notes.map(n => n.content).join(" | "), M: fmt(l.createdAt),
  })));

  // ── Folha 2: Leads Salas ──────────────────────────────────────────────────
  addSheet(wb, "Leads Salas", [
    { header: "Nome",          width: 28 }, { header: "E-mail",        width: 32 },
    { header: "WhatsApp",      width: 20 }, { header: "Empresa",       width: 22 },
    { header: "Plano",         width: 18 }, { header: "Participantes", width: 14 },
    { header: "Data Preferida",width: 24 }, { header: "Hora Preferida",width: 14 },
    { header: "Coffee Break",  width: 14 }, { header: "Observações",   width: 40 },
    { header: "Estado",        width: 18 }, { header: "Registado em",  width: 24 },
  ], roomLeads.map(l => ({
    A: `${l.firstName} ${l.lastName}`, B: l.email, C: l.whatsapp, D: l.company || "",
    E: l.planName, F: l.participants ?? "", G: l.preferredDate ? fmt(l.preferredDate) : "",
    H: l.preferredTime || "", I: l.coffeeBreak ? "Sim" : "Não", J: l.observations || "",
    K: l.status, L: fmt(l.createdAt),
  })));

  // ── Folha 3: Empresas Residentes ─────────────────────────────────────────
  addSheet(wb, "Empresas Residentes", [
    { header: "Nome da Empresa",    width: 30 }, { header: "NIF",              width: 16 },
    { header: "Responsável",        width: 24 }, { header: "E-mail",           width: 30 },
    { header: "WhatsApp",           width: 20 }, { header: "Sala / Escritório",width: 18 },
    { header: "Nº Funcionários",    width: 14 }, { header: "Tipo de Plano",    width: 18 },
    { header: "Início do Contrato", width: 20 }, { header: "Fim do Contrato",  width: 20 },
    { header: "Renda (AOA)",        width: 18 }, { header: "Estado Contrato",  width: 18 },
    { header: "Estado Pagamento",   width: 18 }, { header: "Notas",            width: 40 },
    { header: "Registada em",       width: 24 },
  ], companies.map(c => ({
    A: c.name, B: c.nif || "", C: c.responsible, D: c.email, E: c.whatsapp,
    F: c.roomNumber, G: c.numEmployees, H: c.planType, I: fmtD(c.contractStart),
    J: fmtD(c.contractEnd), K: c.rentAmount, L: c.contractStatus,
    M: c.paymentStatus, N: c.notes || "", O: fmt(c.createdAt),
  })));

  // ── Folha 4: Pagamentos ───────────────────────────────────────────────────
  addSheet(wb, "Pagamentos", [
    { header: "Empresa",           width: 28 }, { header: "Vencimento",        width: 18 },
    { header: "Data de Pagamento", width: 20 }, { header: "Valor (AOA)",       width: 18 },
    { header: "Estado",            width: 16 }, { header: "Notas",             width: 36 },
    { header: "Criado em",         width: 24 },
  ], payments.map(p => ({
    A: p.company?.name ?? "—", B: fmtD(p.dueDate),
    C: p.paidDate ? fmtD(p.paidDate) : "", D: p.amount,
    E: p.status, F: p.notes || "", G: fmt(p.createdAt),
  })));

  // ── Folha 5: Reservas Sala ────────────────────────────────────────────────
  addSheet(wb, "Reservas Sala", [
    { header: "Evento",       width: 28 }, { header: "Empresa",     width: 24 },
    { header: "Responsável",  width: 22 }, { header: "Plano",       width: 16 },
    { header: "Participantes",width: 14 }, { header: "Início",      width: 24 },
    { header: "Fim",          width: 24 }, { header: "Total Horas", width: 12 },
    { header: "Coffee Break", width: 14 }, { header: "Estado",      width: 18 },
    { header: "Registado em", width: 24 },
  ], reservations.map(r => ({
    A: r.eventName, B: r.companyName || "", C: r.responsible, D: r.plan.name,
    E: r.participants, F: fmt(r.startDatetime), G: fmt(r.endDatetime),
    H: r.totalHours, I: r.coffeeBreak ? "Sim" : "Não", J: r.status, K: fmt(r.createdAt),
  })));

  const buf = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="CRM_Azul_Coworking_${date}.xlsx"`,
    },
  });
}
