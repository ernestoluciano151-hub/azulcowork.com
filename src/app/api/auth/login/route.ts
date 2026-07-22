import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { isLoginRateLimited } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // Rate limiting: máx 10 tentativas por IP em 15 minutos
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isLoginRateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiadas tentativas de login. Aguarde 15 minutos e tente novamente." },
      { status: 429 }
    );
  }

  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Indique e-mail e senha." }, { status: 400 });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email: String(email).toLowerCase() } });

  // Comparar sempre (mesmo que utilizador não exista) para evitar timing attacks
  const dummyHash = "$2a$12$invalidhashtopreventtimingattacksxxxxxxxxxxxxxxxxxxxxxxxxx";
  const valid = admin
    ? await bcrypt.compare(password, admin.passwordHash)
    : await bcrypt.compare(password, dummyHash).then(() => false);

  if (!admin || !valid) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  if (!admin.active) {
    return NextResponse.json({ error: "Conta desactivada. Contacte o administrador." }, { status: 403 });
  }

  await createSession({ sub: admin.id, email: admin.email, role: (admin as any).role || "ADMIN", name: admin.name || undefined });
  return NextResponse.json({ ok: true });
}
