import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword)
    return NextResponse.json({ error: "Preencha todos os campos." }, { status: 400 });

  if (String(newPassword).length < 8)
    return NextResponse.json({ error: "A nova senha deve ter pelo menos 8 caracteres." }, { status: 400 });

  const admin = await prisma.adminUser.findUnique({ where: { id: session.sub } });
  if (!admin) return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!valid) return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
