import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Indique e-mail e senha." }, { status: 400 });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!admin) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  await createSession({ sub: admin.id, email: admin.email });
  return NextResponse.json({ ok: true });
}
