import { NextRequest, NextResponse } from "next/server";
import { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { isApiRateLimited } from "@/lib/rateLimit";
import { recordAudit, actorFromSession } from "@/lib/audit-service";

const VALID_ROLES: AdminRole[] = [AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO, AdminRole.VIEWER];

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const users = await prisma.adminUser.findMany({
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isApiRateLimited(ip, "admin-users")) {
    return NextResponse.json({ error: "Demasiados pedidos. Aguarde um momento." }, { status: 429 });
  }

  const { session, error } = await requireRole(AdminRole.ADMIN);
  if (error) return error;

  const count = await prisma.adminUser.count();
  if (count >= 4) return NextResponse.json({ error: "Limite de 4 utilizadores atingido." }, { status: 400 });

  const { email, name, password, role } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Email e senha são obrigatórios." }, { status: 400 });
  if (String(password).length < 8) return NextResponse.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });

  const assignedRole: AdminRole = VALID_ROLES.includes(role) ? (role as AdminRole) : AdminRole.VIEWER;

  const existing = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email já registado." }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.adminUser.create({
    data: {
      email: email.toLowerCase(),
      name: name || null,
      passwordHash,
      role: assignedRole,
    },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });

  recordAudit({
    actor:    actorFromSession(session),
    action:   "ADMIN_USER_CREATED",
    entity:   "AdminUser",
    entityId: user.id,
    entityRef: user.email,
    ipAddress: ip,
    after: { email: user.email, name: user.name, role: user.role },
  }).catch(err => console.error("[Audit] ADMIN_USER_CREATED:", err));

  return NextResponse.json({ user }, { status: 201 });
}
