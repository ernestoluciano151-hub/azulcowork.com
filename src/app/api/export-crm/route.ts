import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const [leads, roomLeads, companies, payments, reservations] = await Promise.all([
    prisma.lead.findMany({ include: { notes: true }, orderBy: { createdAt: "desc" } }),
    prisma.roomBookingLead.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.company.findMany({ include: { payments: true }, orderBy: { createdAt: "desc" } }),
    prisma.payment.findMany({ include: { company: { select: { name: true } } }, orderBy: { dueDate: "desc" } }),
    prisma.reservation.findMany({ include: { plan: { select: { name: true } } }, orderBy: { startDatetime: "desc" } }),
  ]);

  const wb = XLSX.utils.book_new();

  // ── Folha 1: Leads Coworking ──────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    leads.map(l => ({
      "Nome": `${l.firstName} ${l.lastName}`,
      "E-mail": l.email,
      "WhatsApp": l.whatsapp,
      "Empresa": l.company || "",
      "Tipo de Espaço": l.spaceType || "",
      "Plano": l.planName || "",
      "Data Agendada": l.scheduledDate.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
      "Hora": l.appointmentTime || "",
      "Tipo Agendamento": l.appointmentType || "",
      "Estado": l.status,
      "Fonte": l.source || "landing-page",
      "IP": l.ip || "",
      "Notas": l.notes.map(n => n.content).join(" | "),
      "Registado em": l.createdAt.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
    }))
  ), "Leads Coworking");

  // ── Folha 2: Leads Salas ──────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    roomLeads.map(l => ({
      "Nome": `${l.firstName} ${l.lastName}`,
      "E-mail": l.email,
      "WhatsApp": l.whatsapp,
      "Empresa": l.company || "",
      "Plano": l.planName,
      "Participantes": l.participants || "",
      "Data Preferida": l.preferredDate ? l.preferredDate.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }) : "",
      "Hora Preferida": l.preferredTime || "",
      "Coffee Break": l.coffeeBreak ? "Sim" : "Não",
      "Observações": l.observations || "",
      "Estado": l.status,
      "Fonte": l.source,
      "IP": l.ip || "",
      "Registado em": l.createdAt.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
    }))
  ), "Leads Salas");

  // ── Folha 3: Empresas Residentes ─────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    companies.map(c => ({
      "Nome da Empresa": c.name,
      "NIF": c.nif || "",
      "Responsável": c.responsible,
      "E-mail": c.email,
      "WhatsApp": c.whatsapp,
      "Sala / Escritório": c.roomNumber,
      "Nº Funcionários": c.numEmployees,
      "Tipo de Plano": c.planType,
      "Início do Contrato": c.contractStart.toLocaleDateString("pt-PT"),
      "Fim do Contrato": c.contractEnd.toLocaleDateString("pt-PT"),
      "Valor Renda (AOA)": c.rentAmount,
      "Estado do Contrato": c.contractStatus,
      "Estado de Pagamento": c.paymentStatus,
      "URL Contrato": c.contractFileUrl || "",
      "Notas": c.notes || "",
      "Registada em": c.createdAt.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
    }))
  ), "Empresas Residentes");

  // ── Folha 4: Pagamentos ───────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    payments.map(p => ({
      "Empresa": p.company.name,
      "Vencimento": p.dueDate.toLocaleDateString("pt-PT"),
      "Data de Pagamento": p.paidDate ? p.paidDate.toLocaleDateString("pt-PT") : "",
      "Valor (AOA)": p.amount,
      "Estado": p.status,
      "Notas": p.notes || "",
      "Criado em": p.createdAt.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
    }))
  ), "Pagamentos");

  // ── Folha 5: Reservas Sala ────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    reservations.map(r => ({
      "Evento": r.eventName,
      "Empresa": r.companyName || "",
      "Responsável": r.responsible,
      "Plano": r.plan.name,
      "Participantes": r.participants,
      "Início": r.startDatetime.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
      "Fim": r.endDatetime.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
      "Total Horas": r.totalHours,
      "Coffee Break": r.coffeeBreak ? "Sim" : "Não",
      "Preço Personalizado": r.isCustomPricing ? "Sim" : "Não",
      "Pedido Personalizado": r.customRequest || "",
      "Observações": r.observations || "",
      "Estado": r.status,
      "Registado em": r.createdAt.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }),
    }))
  ), "Reservas Sala");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="CRM_Azul_Coworking_${date}.xlsx"`,
    },
  });
}
