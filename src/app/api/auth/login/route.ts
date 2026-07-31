import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, createTempToken } from "@/lib/auth";
import { isLoginRateLimited } from "@/lib/rateLimit";
import { recordAudit, UNKNOWN_ACTOR } from "@/lib/audit-service";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua = req.headers.get("user-agent") ?? undefined;

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

  const admins = await prisma.$queryRaw<Array<{
    id: string; email: string; passwordHash: string; name: string | null;
    active: boolean; role: string; totpEnabled: boolean; totpSecret: string | null;
  }>>`SELECT id, email, "passwordHash", name, active, role::text, "totpEnabled", "totpSecret"
      FROM "AdminUser" WHERE email = ${String(email).toLowerCase()} LIMIT 1`;
  const admin = admins[0] ?? null;
  });

  // Comparar sempre (mesmo que utilizador não exista) para evitar timing attacks
  const dummyHash = "$2a$12$invalidhashtopreventtimingattacksxxxxxxxxxxxxxxxxxxxxxxxxx";
  const valid = admin
    ? await bcrypt.compare(password, admin.passwordHash)
    : await bcrypt.compare(password, dummyHash).then(() => false);

  if (!admin || !valid) {
    // Audit: login falhado — actorId "UNKNOWN" se email inexistente
    const actor = admin
      ? { id: admin.id, role: String(admin.role), email: admin.email }
      : { ...UNKNOWN_ACTOR, email: String(email).toLowerCase() };

    recordAudit({
      actor,
      action:    "LOGIN_FAILED",
      entity:    "AdminUser",
      entityId:  admin?.id ?? "UNKNOWN",
      entityRef: String(email).toLowerCase(),
      ipAddress: ip,
      userAgent: ua,
      metadata:  { reason: !admin ? "USER_NOT_FOUND" : "INVALID_PASSWORD" },
    }).catch(err => console.error("[Audit] LOGIN_FAILED:", err));

    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  if (!admin.active) {
    recordAudit({
      actor:     { id: admin.id, role: String(admin.role), email: admin.email },
      action:    "LOGIN_FAILED",
      entity:    "AdminUser",
      entityId:  admin.id,
      entityRef: admin.email,
      ipAddress: ip,
      userAgent: ua,
      metadata:  { reason: "ACCOUNT_INACTIVE" },
    }).catch(err => console.error("[Audit] LOGIN_FAILED inactive:", err));

    return NextResponse.json(
      { error: "Conta desactivada. Contacte o administrador." },
      { status: 403 }
    );
  }

  // 2FA: se o utilizador tem TOTP activado, emitir token temporário.
  // O audit de LOGIN_SUCCESS ocorre em /api/auth/totp/verify após confirmação do código.
  if (admin.totpEnabled && admin.totpSecret) {
    const tempToken = await createTempToken({ sub: admin.id, email: admin.email });
    return NextResponse.json({ requireTotp: true, tempToken });
  }

  // Criar sessão JWT + AdminSession na BD (VOL05-2)
  await createSession(
    { sub: admin.id, email: admin.email, role: admin.role, name: admin.name || undefined },
    { ipAddress: ip, userAgent: ua }
  );

  // Audit: login bem-sucedido (post-commit)
  recordAudit({
    actor:     { id: admin.id, role: String(admin.role), email: admin.email },
    action:    "LOGIN_SUCCESS",
    entity:    "AdminUser",
    entityId:  admin.id,
    entityRef: admin.email,
    ipAddress: ip,
    userAgent: ua,
  }).catch(err => console.error("[Audit] LOGIN_SUCCESS:", err));

  return NextResponse.json({ ok: true });
}
