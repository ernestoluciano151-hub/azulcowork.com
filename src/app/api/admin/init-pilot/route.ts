/**
 * ENDPOINT TEMPORÁRIO — APAGAR APÓS PRIMEIRO USO
 *
 * Inicializa as contas de administrador do piloto RC-1 directamente
 * na base de dados de produção.
 *
 * Protegido por PILOT_SETUP_SECRET (variável de ambiente Vercel).
 * Idempotente: actualiza password se conta já existir, cria se não existir.
 *
 * USO (uma única vez):
 *   curl -s -X POST https://azulcowork.com/api/admin/init-pilot \
 *     -H "Content-Type: application/json" \
 *     -d '{"secret":"SEU_PILOT_SETUP_SECRET"}' | jq .
 *
 * APÓS USAR: apagar este ficheiro e fazer novo deploy imediatamente.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const CHARSET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";

function generatePassword(): string {
  const bytes = crypto.randomBytes(20);
  return Array.from(bytes)
    .map((b) => CHARSET[b % CHARSET.length])
    .join("");
}

const ADMINS = [
  { name: "Ernesto Luciano",       email: "ernesto@azulcowork.com",    role: "ADMIN" },
  { name: "Operações Azul Cowork", email: "operacoes@azulcowork.com",  role: "ADMIN" },
];

export async function POST(req: NextRequest) {
  const setupSecret = process.env.PILOT_SETUP_SECRET;

  if (!setupSecret) {
    return NextResponse.json(
      { error: "PILOT_SETUP_SECRET não configurada." },
      { status: 500 }
    );
  }

  let body: { secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  if (body.secret !== setupSecret) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const results = [];

  for (const admin of ADMINS) {
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await prisma.adminUser.findUnique({
      where: { email: admin.email },
    });

    if (existing) {
      await prisma.adminUser.update({
        where: { email: admin.email },
        data: { passwordHash, active: true },
      });
      results.push({ email: admin.email, name: admin.name, role: admin.role, action: "updated", password });
    } else {
      await prisma.adminUser.create({
        data: {
          name: admin.name,
          email: admin.email,
          passwordHash,
          role: admin.role as "ADMIN",
          active: true,
          totpEnabled: false,
        },
      });
      results.push({ email: admin.email, name: admin.name, role: admin.role, action: "created", password });
    }
  }

  return NextResponse.json({
    ok: true,
    message: "⚠️ Copie as credenciais abaixo. Apague este endpoint imediatamente.",
    results,
  });
}
