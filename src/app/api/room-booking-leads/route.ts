import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { sendNewRoomLeadEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
    const body = await req.json();
    const { firstName, lastName, company, email, whatsapp, planName, participants, preferredDate, preferredTime, observations, coffeeBreak } = body;
    if (!firstName || !lastName || !email || !whatsapp || !planName) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
    }
    const lead = await prisma.roomBookingLead.create({
      data: {
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        company: company ? String(company).trim() : null,
        email: String(email).trim().toLowerCase(),
        whatsapp: String(whatsapp).trim(),
        planName: String(planName).trim(),
        participants: participants ? Number(participants) : null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        preferredTime: preferredTime || null,
        observations: observations ? String(observations).trim() : null,
        coffeeBreak: Boolean(coffeeBreak),
        ip,
      }
    });
    // Notificação por email (não bloqueia a resposta)
    sendNewRoomLeadEmail(lead).catch(() => {});

    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (err) {
    console.error("Erro ao criar room booking lead:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL);
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const planName = searchParams.get("planName");
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "20");
  const companyId = searchParams.get("companyId");
  const where: any = {};
  if (status && status !== "ALL") where.status = status;
  if (planName && planName !== "ALL") where.planName = planName;
  if (companyId) where.companyId = companyId;
  const [leads, total] = await Promise.all([
    prisma.roomBookingLead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page-1)*pageSize, take: pageSize }),
    prisma.roomBookingLead.count({ where })
  ]);
  return NextResponse.json({ leads, total, page, pageSize });
}
