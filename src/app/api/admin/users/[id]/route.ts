import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { name, email, role, active, newPassword } = await req.json();
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email.toLowerCase();
  if (role !== undefined) updateData.role = role === "ADMIN" ? "ADMIN" : "USER";
  if (active !== undefined) updateData.active = active;
  if (newPassword) {
    updateData.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  const user = await prisma.adminUser.update({
    where: { id: params.id },
    data: updateData,
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json({ user });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  if (session.sub === params.id) {
    return NextResponse.json({ error: "Não pode eliminar a sua própria conta." }, { status: 400 });
  }

  await prisma.adminUser.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
