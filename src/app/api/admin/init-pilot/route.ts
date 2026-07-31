/**
 * ENDPOINT TEMPORÁRIO — APAGAR APÓS PRIMEIRO USO
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";

const CHARSET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";

function generatePassword(): string {
  const bytes = crypto.randomBytes(20);
  return Array.from(bytes)
    .map((b) => CHARSET[b % CHARSET.length])
    .join("");
}

const ADMINS = [
  { name: "Ernesto Luciano",       email: "ernesto@azulcowork.com",   role: AdminRole.ADMIN },
  { name: "Operações Azul Cowork", email: "operacoes@azulcowork.com", role: AdminRole.ADMIN },
];

export async function POST(req: NextRequest) {
  try {
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
            role: admin.role,
            active: true,
            totpEnabled: false,
          },
        });
        results.push({ email: admin.email, name: admin.name, role: admin.role, action: "created", password });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Copie as credenciais. Apague este endpoint imediatamente.",
      results,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.slice(0, 500) : undefined;
    return NextResponse.json(
      { error: "Erro interno", detail: message, stack },
      { status: 500 }
    );
  }
}
