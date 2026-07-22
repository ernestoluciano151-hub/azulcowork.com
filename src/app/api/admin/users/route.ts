import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const users = await prisma.adminUser.findMany({
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const count = await prisma.adminUser.count();
  if (count >= 4) return NextResponse.json({ error: "Limite de 4 utilizadores atingido." }, { status: 400 });

  const { email, name, password, role } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Email e senha são obrigatórios." }, { status: 400 });
  if (String(password).length < 8) return NextResponse.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });

  const existing = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email já registado." }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.adminUser.create({
    data: {
      email: email.toLowerCase(),
      name: name || null,
      passwordHash,
      role: role === "ADMIN" ? "ADMIN" : "USER",
    },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json({ user }, { status: 201 });
}
