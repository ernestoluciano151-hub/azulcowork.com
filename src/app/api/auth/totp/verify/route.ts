/**
 * POST /api/auth/totp/verify
 *
 * Passo 2 do login com 2FA.
 * Recebe o token temporário (emitido pelo login) e o código TOTP do utilizador.
 * Se ambos forem válidos, cria a sessão completa.
 *
 * Body: { tempToken: string; code: string }
 * Resposta OK: { ok: true }
 * Resposta erro: 401 (token inválido/expirado ou código TOTP errado)
 */

import { NextRequest, NextResponse } from "next/server";
import * as OTPAuth from "otpauth";
import { prisma } from "@/lib/prisma";
import { verifyTempToken, createSession } from "@/lib/auth";
import { isTotpRateLimited } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // Rate limiting: 5 tentativas por IP em 5 minutos (previne brute-force de códigos 6 dígitos)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isTotpRateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiadas tentativas. Aguarde 5 minutos e tente novamente." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.tempToken !== "string" || typeof body.code !== "string") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const { tempToken, code } = body as { tempToken: string; code: string };

  // 1. Verificar token temporário
  const tokenPayload = await verifyTempToken(tempToken);
  if (!tokenPayload) {
    // Não revelar se foi o token ou o código que falhou — evitar enumeração
    return NextResponse.json({ error: "Código ou sessão inválidos." }, { status: 401 });
  }

  // 2. Carregar utilizador (verificar que ainda está activo e TOTP ainda está activado)
  const admin = await prisma.adminUser.findUnique({
    where: { id: tokenPayload.sub },
    select: { id: true, email: true, role: true, name: true, active: true, totpEnabled: true, totpSecret: true },
  });

  if (!admin || !admin.active || !admin.totpEnabled || !admin.totpSecret) {
    return NextResponse.json({ error: "Código ou sessão inválidos." }, { status: 401 });
  }

  // 3. Verificar código TOTP (janela de 1 período = ±30s de tolerância)
  const totp = new OTPAuth.TOTP({
    issuer:    "Azul Coworking",
    label:     admin.email,
    algorithm: "SHA1",
    digits:    6,
    period:    30,
    secret:    OTPAuth.Secret.fromBase32(admin.totpSecret),
  });

  const sanitizedCode = code.replace(/\s/g, "");
  const delta = totp.validate({ token: sanitizedCode, window: 1 });

  if (delta === null) {
    return NextResponse.json({ error: "Código ou sessão inválidos." }, { status: 401 });
  }

  // 4. Código válido — criar sessão completa
  await createSession({
    sub:   admin.id,
    email: admin.email,
    role:  admin.role,
    name:  admin.name || undefined,
  });

  return NextResponse.json({ ok: true });
}
