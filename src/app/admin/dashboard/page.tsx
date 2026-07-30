export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import AdminLayout from "@/components/admin/AdminLayout";
import KpiCard from "@/components/admin/KpiCard";
import MonthlyReportPdf from "@/components/admin/MonthlyReportPdf";
import RevenueChart from "@/components/admin/charts/RevenueChart";
import OccupancyChart from "@/components/admin/charts/OccupancyChart";
import LeadFunnelChart from "@/components/admin/charts/LeadFunnelChart";
import PaymentStatusChart from "@/components/admin/charts/PaymentStatusChart";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatKz } from "@/lib/currency";

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M Kz`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K Kz`;
  return formatKz(v);
}

function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  ATIVO:          "bg-emerald-500/15 text-emerald-300",
  PRESTES_EXPIRAR:"bg-amber-500/15 text-amber-300",
  RENOVADO:       "bg-blue-500/15 text-blue-300",
  ENCERRADO:      "bg-red-500/15 text-red-300",
};

export default async function DashboardPage() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const in60 = new Date(now); in60.setDate(in60.getDate() + 60);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    activeCompanies,
    mrrAgg,
    pendingPayments,
    upcomingReservations,
    pendingDeletes,
    overduePayments,
    expiringContracts,
    upcoming,
  ] = await Promise.all([
    prisma.company.count({
      where: { contractStatus: { in: ["ATIVO", "PRESTES_EXPIRAR"] } },
    }),
    prisma.company.aggregate({
      where: { contractStatus: { in: ["ATIVO", "PRESTES_EXPIRAR"] } },
      _sum: { rentAmount: true },
    }),
    prisma.payment.count({ where: { status: { in: ["PENDENTE", "ATRASADO"] } } }),
    prisma.reservation.count({
      where: { status: "CONFIRMADA", startDatetime: { gte: now, lte: weekAhead } },
    }),
    prisma.deleteRequest.count({ where: { status: "PENDING" } }),
    prisma.payment.count({ where: { status: "ATRASADO" } }),
    prisma.company.findMany({
      where: { contractEnd: { lte: in60 }, contractStatus: { notIn: ["ENCERRADO"] } },
      orderBy: { contractEnd: "asc" },
      take: 5,
    }),
    prisma.lead.findMany({
      where: { scheduledDate: { gte: now } },
      orderBy: { scheduledDate: "asc" },
      take: 6,
    }),
  ]);

  const mrr = mrrAgg._sum.rentAmount ?? 0;

  return (
    <AdminLayout>
      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper">
            Dashboard Executivo
          </h1>
          <p className="mt-1 text-sm text-mist">
            Visão consolidada — Azul Coworking
          </p>
        </div>
        <a
          href="/api/export-crm"
          download
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Exportar CRM (.xlsx)
        </a>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Empresas Activas"
          value={activeCompanies}
          icon="🏢"
          variant="default"
        />
        <KpiCard
          label="MRR"
          value={fmtShort(mrr)}
          sub="Receita mensal recorrente"
          icon="💰"
          variant="success"
        />
        <KpiCard
          label="Pgtos Pendentes"
          value={pendingPayments}
          icon="⏳"
          variant={pendingPayments > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Reservas (7d)"
          value={upcomingReservations}
          icon="📅"
          variant="info"
        />
        <KpiCard
          label="Aprovações"
          value={pendingDeletes}
          icon="🗑️"
          variant={pendingDeletes > 0 ? "danger" : "default"}
        />
      </div>

      {/* ── Alertas ───────────────────────────────────────────────────── */}
      {overduePayments > 0 && (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center justify-between">
          <p className="text-sm text-red-300">
            ⚠ {overduePayments} pagamento(s) em atraso
          </p>
          <Link
            href="/admin/pagamentos"
            className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30"
          >
            Ver pagamentos
          </Link>
        </div>
      )}
      {pendingDeletes > 0 && (
        <div className="mt-3 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4 flex items-center justify-between">
          <p className="text-sm text-orange-300">
            🗑️ {pendingDeletes} pedido(s) de eliminação aguardam aprovação
          </p>
          <Link
            href="/admin/delete-requests"
            className="rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-500/30"
          >
            Ver pedidos
          </Link>
        </div>
      )}

      {/* ── Exportar Relatório PDF ───────────────────────────────────── */}
      <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-300">Relatório Executivo Mensal</p>
          <p className="text-xs text-mist mt-0.5">PDF com dados financeiros, sala e CRM consolidados</p>
        </div>
        <MonthlyReportPdf />
      </div>

      {/* ── Gráficos ──────────────────────────────────────────────────── */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Receita Mensal */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-display text-base font-semibold text-paper">
            Receita Mensal (12 meses)
          </h2>
          <p className="mt-0.5 text-xs text-mist">Coworking + Sala de Reunião</p>
          <div className="mt-4">
            <RevenueChart months={12} />
          </div>
        </div>

        {/* Taxa de Ocupação */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-display text-base font-semibold text-paper">
            Ocupação da Sala (12 meses)
          </h2>
          <p className="mt-0.5 text-xs text-mist">% de horas úteis reservadas</p>
          <div className="mt-4">
            <OccupancyChart months={12} />
          </div>
        </div>

        {/* Funil de Leads */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-display text-base font-semibold text-paper">
            Funil de Leads CRM
          </h2>
          <p className="mt-0.5 text-xs text-mist">Distribuição por estado do pipeline</p>
          <div className="mt-4">
            <LeadFunnelChart />
          </div>
        </div>

        {/* Estado de Pagamentos */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-display text-base font-semibold text-paper">
            Estado dos Pagamentos
          </h2>
          <p className="mt-0.5 text-xs text-mist">Coworking + Sala — acumulado</p>
          <div className="mt-4">
            <PaymentStatusChart />
          </div>
        </div>
      </div>

      {/* ── Alertas de contratos ───────────────────────────────────────── */}
      {expiringContracts.length > 0 && (
        <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="font-display text-lg font-bold text-amber-300">
            ⚠️ Contratos a Expirar (60 dias)
          </h2>
          <ul className="mt-4 divide-y divide-white/5">
            {expiringContracts.map((c) => {
              const daysLeft = Math.ceil(
                (c.contractEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              );
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-paper">{c.name}</p>
                    <p className="text-mist">{c.responsible} · {c.roomNumber}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        CONTRACT_STATUS_COLORS[c.contractStatus] ?? "bg-white/10 text-mist"
                      }`}
                    >
                      {c.contractStatus.replace("_", " ")}
                    </span>
                    <p className="mt-1 text-xs text-mist">
                      {daysLeft <= 0
                        ? "Expirado"
                        : `Expira em ${daysLeft} dia(s) — ${format(c.contractEnd, "dd/MM/yyyy")}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Próximos agendamentos ──────────────────────────────────────── */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-paper">
            Próximos Agendamentos
          </h2>
          <Link
            href="/admin/leads"
            className="text-xs text-mist hover:text-paper transition"
          >
            Ver todos →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-mist">Sem agendamentos futuros.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {upcoming.map((lead) => (
              <li
                key={lead.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-paper">
                    {lead.firstName} {lead.lastName}
                  </p>
                  <p className="text-mist">{lead.whatsapp}</p>
                </div>
                <span className="text-mist text-xs">
                  {format(lead.scheduledDate, "PPP", { locale: ptBR })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
}
