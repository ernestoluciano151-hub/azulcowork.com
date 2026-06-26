import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, looksLikeBot } from "@/lib/rateLimit";
import { isValidEmail, isValidWhatsapp, sanitizeText } from "@/lib/validators";
import { getSession } from "@/lib/auth";

// POST /api/leads -> usado pelo formulário público da landing page
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Demasiadas tentativas. Tente mais tarde." }, { status: 429 });
    }

    const body = await req.json();
    const { firstName, lastName, email, whatsapp, scheduledDate, formStartedAt, honeypot } = body;

    if (looksLikeBot(Number(formStartedAt) || 0, honeypot || "")) {
      // Resposta "de sucesso" para não dar pistas a bots, mas não grava nada.
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (!firstName || !lastName || !email || !whatsapp || !scheduledDate) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }
    if (!isValidWhatsapp(whatsapp)) {
      return NextResponse.json({ error: "Número de WhatsApp inválido." }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        firstName: sanitizeText(firstName),
        lastName: sanitizeText(lastName),
        email: sanitizeText(email).toLowerCase(),
        whatsapp: sanitizeText(whatsapp),
        scheduledDate: new Date(scheduledDate),
        ip,
        source: "landing-page"
      }
    });

    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (err) {
    console.error("Erro ao criar lead:", err);
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}

// GET /api/leads -> usado pelo CRM (protegido por sessão de admin)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const sort = searchParams.get("sort") || "scheduledDate";
  const order = (searchParams.get("order") || "asc") as "asc" | "desc";
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "10");

  const where: any = {};
  if (status && status !== "ALL") where.status = status;
  if (from || to) {
    where.scheduledDate = {};
    if (from) where.scheduledDate.gte = new Date(from);
    if (to) where.scheduledDate.lte = new Date(to);
  }
  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
      { whatsapp: { contains: q } }
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { notes: { orderBy: { createdAt: "desc" } } }
    }),
    prisma.lead.count({ where })
  ]);

  return NextResponse.json({ leads, total, page, pageSize });
}
