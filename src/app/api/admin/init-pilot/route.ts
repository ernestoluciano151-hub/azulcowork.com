/**
 * ENDPOINT TEMPORÁRIO — APAGAR APÓS PRIMEIRO USO
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
  { name: "Ernesto Luciano",       email: "ernesto@azulcowork.com" },
  { name: "Operações Azul Cowork", email: "operacoes@azulcowork.com" },
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

      // Raw SQL — bypasses Prisma enum conversion entirely
      const existing = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "AdminUser" WHERE email = ${admin.email} LIMIT 1
      `;

      if (existing.length > 0) {
        await prisma.$executeRaw`
          UPDATE "AdminUser"
          SET "passwordHash" = ${passwordHash}, active = true
          WHERE email = ${admin.email}
        `;
        results.push({ email: admin.email, name: admin.name, action: "updated", password });
      } else {
        const id = crypto.randomUUID();
        const now = new Date();
        await prisma.$executeRaw`
          INSERT INTO "AdminUser" (id, name, email, "passwordHash", role, active, "totpEnabled", "createdAt", "updatedAt")
          VALUES (${id}, ${admin.name}, ${admin.email}, ${passwordHash}, 'ADMIN', true, false, ${now}, ${now})
        `;
        results.push({ email: admin.email, name: admin.name, action: "created", password });
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
