/**
 * GET /api/admin/portal/users
 * POST /api/admin/portal/users
 *
 * Provisioning de utilizadores do Portal do Cliente.
 * Reservado a AdminUser com role ADMIN ou FINANCEIRO.
 *
 * GET  — lista todos os PortalUsers, agrupados por empresa.
 *        Inclui estatísticas de actividade (último login, sessões activas).
 *
 * POST — cria um PortalUser com role PORTAL_OWNER para uma empresa.
 *        Opções: com passwordHash OU sem (usa Magic Link para o primeiro login).
 *        Não expõe passwordHash na resposta.
 *
 * Regras:
 *  - Uma empresa pode ter no máximo 1 PORTAL_OWNER (criado aqui — nunca via portal público)
 *  - Se a empresa já tiver PORTAL_OWNER activo, retorna 409
 *  - O email deve ser único por empresa (@@unique([companyId, email]))
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminRole, PortalRole }     from "@prisma/client";
import { prisma }                     from "@/lib/prisma";
import { requireRole }                from "@/lib/auth";
import { isApiRateLimited }           from "@/lib/rateLimit";
import { sendEmail }                  from "@/lib/communication-service";
import { z }                          from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  companyId: z.string().cuid("companyId inválido."),
  name:      z.string().min(2, "Nome deve ter pelo menos 2 caracteres.").max(120),
  email:     z.string().email("Email inválido.").max(255),
  // password opcional: se ausente, o utilizador usa Magic Link no 1.º login
  password:  z.string().min(8, "Password deve ter pelo menos 8 caracteres.").max(128).optional(),
});

// ── GET — listar todos os PortalUsers ────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const users = await prisma.portalUser.findMany({
    select: {
      id:          true,
      name:        true,
      email:       true,
      role:        true,
      isActive:    true,
      isConfirmed: true,
      lastLoginAt: true,
      createdAt:   true,
      company: {
        select: { id: true, name: true },
      },
      _count: {
        select: {
          sessions:      true, // sessões totais (inclui revogadas)
          notifications: true,
        },
      },
    },
    orderBy: [
      { company: { name: "asc" } },
      { role: "desc" },
    ],
  });

  // Contar sessões activas separadamente (não revogadas e não expiradas)
  const now = new Date();
  const activeSessions = await prisma.portalSession.groupBy({
    by:     ["portalUserId"],
    where:  { isRevoked: false, expiresAt: { gt: now } },
    _count: { id: true },
  });
  const activeSessionMap = new Map(
    activeSessions.map(s => [s.portalUserId, s._count.id])
  );

  const enriched = users.map(u => ({
    ...u,
    activeSessionCount: activeSessionMap.get(u.id) ?? 0,
    passwordHash:       undefined, // nunca expor
  }));

  return NextResponse.json({ users: enriched, total: enriched.length });
}

// ── POST — criar PortalUser (PORTAL_OWNER) para empresa ─────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "admin-portal-users")) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarde um momento." },
      { status: 429 }
    );
  }

  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const { companyId, name, email, password } = parsed.data;

  // Verificar que a empresa existe
  const company = await prisma.company.findUnique({
    where:  { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  // Verificar que não existe já um PORTAL_OWNER activo para esta empresa
  const existingOwner = await prisma.portalUser.findFirst({
    where: { companyId, role: PortalRole.PORTAL_OWNER, isActive: true },
  });
  if (existingOwner) {
    return NextResponse.json(
      {
        error: `A empresa ${company.name} já tem um PORTAL_OWNER activo (${existingOwner.email}). `
          + "Use a transferência de ownership ou desactive o utilizador existente.",
      },
      { status: 409 }
    );
  }

  // Verificar email único na empresa
  const emailConflict = await prisma.portalUser.findFirst({
    where: { companyId, email: email.toLowerCase().trim() },
  });
  if (emailConflict) {
    return NextResponse.json(
      { error: "Este email já está registado nesta empresa." },
      { status: 409 }
    );
  }

  // Hash da password (se fornecida)
  let passwordHash: string | undefined;
  if (password) {
    const { hash } = await import("bcryptjs");
    passwordHash = await hash(password, 12);
  }

  const user = await prisma.portalUser.create({
    data: {
      companyId,
      name:         name.trim(),
      email:        email.toLowerCase().trim(),
      role:         PortalRole.PORTAL_OWNER,
      isActive:     true,
      isConfirmed:  false, // será confirmado no 1.º login (magic link ou password)
      passwordHash: passwordHash ?? null,
    },
    select: {
      id:          true,
      name:        true,
      email:       true,
      role:        true,
      isActive:    true,
      isConfirmed: true,
      createdAt:   true,
      company: {
        select: { id: true, name: true },
      },
    },
  });

  // Email boas-vindas — fire-and-forget (falha nunca bloqueia o 201)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const portalLoginUrl = `${appUrl}/portal/login`;
  const accessMethod = passwordHash
    ? "A sua password foi definida pelo administrador. Use-a para aceder ao portal."
    : "Para aceder pela primeira vez, utilize a opção \"Link de Acesso\" (Magic Link) na página de login — receberá um link seguro no seu email.";

  void sendEmail({
    templateSlug: "portal-welcome",
    to: user.email,
    subject: `Bem-vindo ao Portal Azul Coworking — ${user.company.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e40af">Azul Coworking — Portal do Cliente</h2>
        <p>Olá <strong>${user.name}</strong>,</p>
        <p>A sua conta de acesso ao portal <strong>${user.company.name}</strong> foi criada com sucesso.</p>
        <p>${accessMethod}</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${portalLoginUrl}"
             style="background:#1e40af;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
            Aceder ao Portal
          </a>
        </p>
        <p>No portal pode consultar as suas faturas, pagamentos, contratos, documentos e efectuar reservas de salas.</p>
        <p style="font-size:12px;color:#6b7280">
          Azul Coworking · Bairro Azul, Edifício 18, Luanda, Angola<br>
          geral@azulcowork.com · 976 467 124
        </p>
      </div>`,
    vars: {
      name: user.name,
      companyName: user.company.name,
      portalLoginUrl,
      accessMethod,
    },
    channel: "transactional",
    entityType: "PORTAL_USER",
    entityId: user.id,
    triggeredBy: "ADMIN",
  }).catch((err: unknown) =>
    console.error("[Admin Portal Users] Erro ao enviar email boas-vindas:", err)
  );

  return NextResponse.json({ ok: true, user }, { status: 201 });
}
