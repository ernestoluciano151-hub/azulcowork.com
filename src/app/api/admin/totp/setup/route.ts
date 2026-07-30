/**
 * /api/admin/totp/setup
 *
 * GET  — Gera um novo secret TOTP e retorna a URI para o QR code.
 *         O secret ainda NÃO é guardado. O utilizador deve confirmar com POST.
 *
 * POST — Activa o TOTP após confirmação do código.
 *         Body: { secret: string; code: string }
 *         Guarda o secret e activa totpEnabled = true.
 *
 * DELETE — Desactiva o TOTP.
 *           Body: { password: string } — requer confirmação de senha.
 *
 * Todos os endpoints requerem sessão válida (qualquer role autenticado).
 */

import { NextRequest, NextResponse } from "next/server";
import * as OTPAuth from "otpauth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

const ISSUER = "Azul Coworking";

// ── GET — Gerar novo secret (sem guardar) ────────────────────────────────────
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  // Gerar secret aleatório
  const secret = new OTPAuth.Secret({ size: 20 });

  const totp = new OTPAuth.TOTP({
    issuer:    ISSUER,
    label:     session.email,
    algorithm: "SHA1",
    digits:    6,
    period:    30,
    secret,
  });

  // URI compatível com Google Authenticator, Authy, etc.
  const uri = totp.toString();

  return NextResponse.json({
    secret: secret.base32,
    uri,
    // O QR code pode ser gerado no cliente a partir desta URI
    // (ex: usando qrcode.js ou serviço externo)
    qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`,
  });
}

// ── POST — Confirmar e activar TOTP ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.secret !== "string" || typeof body.code !== "string") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const { secret, code } = body as { secret: string; code: string };

  // Verificar o código TOTP com o secret fornecido
  let base32Secret: OTPAuth.Secret;
  try {
    base32Secret = OTPAuth.Secret.fromBase32(secret);
  } catch {
    return NextResponse.json({ error: "Secret inválido." }, { status: 400 });
  }

  const totp = new OTPAuth.TOTP({
    issuer:    ISSUER,
    label:     session.email,
    algorithm: "SHA1",
    digits:    6,
    period:    30,
    secret:    base32Secret,
  });

  const sanitizedCode = code.replace(/\s/g, "");
  const delta = totp.validate({ token: sanitizedCode, window: 1 });

  if (delta === null) {
    return NextResponse.json({ error: "Código inválido. Verifique o seu authenticator." }, { status: 400 });
  }

  // Guardar secret e activar TOTP
  await prisma.adminUser.update({
    where: { id: session.sub },
    data:  { totpSecret: secret, totpEnabled: true },
  });

  return NextResponse.json({ ok: true, message: "Autenticação de dois factores activada com sucesso." });
}

// ── DELETE — Desactivar TOTP ─────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.password !== "string") {
    return NextResponse.json({ error: "Senha obrigatória para desactivar o 2FA." }, { status: 400 });
  }

  // Confirmar password antes de desactivar (segurança adicional)
  const admin = await prisma.adminUser.findUnique({
    where:  { id: session.sub },
    select: { passwordHash: true },
  });

  if (!admin) {
    return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });
  }

  const valid = await bcrypt.compare(body.password, admin.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Senha incorrecta." }, { status: 401 });
  }

  await prisma.adminUser.update({
    where: { id: session.sub },
    data:  { totpSecret: null, totpEnabled: false },
  });

  return NextResponse.json({ ok: true, message: "Autenticação de dois factores desactivada." });
}
