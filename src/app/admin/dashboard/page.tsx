export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/admin/Sidebar";
import StatsCard from "@/components/admin/StatsCard";
import LeadsChart from "@/components/admin/LeadsChart";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatKz } from "@/lib/currency";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeekFn(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  ATIVO: "bg-emerald-500/15 text-emerald-300",
  PRESTES_EXPIRAR: "bg-amber-500/15 text-amber-300",
  RENOVADO: "bg-blue-500/15 text-blue-300",
  ENCERRADO: "bg-red-500/15 text-red-300"
};

export default async function DashboardPage() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeekFn(now);
  const in60 = new Date(now); in60.setDate(in60.getDate() + 60);

  const [total, today, week, upcoming, totalCompanies, expiringContracts, overduePayments, todayReservations, weekReservations, pendingDeletes, totalPaidAgg, totalDebtAgg] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.lead.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.lead.findMany({
      where: { scheduledDate: { gte: now } },
      orderBy: { scheduledDate: "asc" },
      take: 6
    }),
    prisma.company.count(),
    prisma.company.findMany({
      where: { contractEnd: { lte: in60 }, contractStatus: { notIn: ["ENCERRADO"] } },
      orderBy: { contractEnd: "asc" },
      take: 5
    }),
    prisma.payment.count({ where: { status: "ATRASADO" } }),
    prisma.reservation.count({
      where: {
        startDatetime: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) },
        status: "CONFIRMADA"
      }
    }),
    prisma.reservation.count({
      where: {
        startDatetime: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) },
        status: "CONFIRMADA"
      }
    }),
    prisma.deleteRequest.count({ where: { status: "PENDING" } }),
    prisma.payment.aggregate({ where: { status: "PAGO" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "ATRASADO" }, _sum: { amount: true } }),
  ]);

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-paper">Dashboard</h1>
            <p className="mt-1 text-sm text-mist">Visão geral do CRM.</p>
          </div>
          <a
            href="/api/export-crm"
            download
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Exportar CRM completo (.xlsx)
          </a>
        </div>

        {/* Leads stats */}
        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-mist">Leads</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatsCard label="Total de leads" value={total} />
          <StatsCard label="Leads hoje" value={today} />
          <StatsCard label="Leads esta semana" value={week} />
        </div>

        {/* Company & Sala stats */}
        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-mist">Empresas & Sala de Reunião</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard label="Total de empresas" value={totalCompanies} />
          <StatsCard label="Contratos a expirar (60d)" value={expiringContracts.length} />
          <StatsCard label="Reservas hoje" value={todayReservations} />
          <StatsCard label="Eventos esta semana" value={weekReservations} />
        </div>

        {/* Pagamentos stats */}
        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-mist">Pagamentos</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Total em caixa (recebido)</p>
            <p className="mt-2 text-2xl font-bold text-emerald-300">{formatKz(totalPaidAgg._sum.amount || 0)}</p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Em atraso (AOA)</p>
            <p className="mt-2 text-2xl font-bold text-red-300">{formatKz(totalDebtAgg._sum.amount || 0)}</p>
          </div>
        </div>

        {pendingDeletes > 0 && (
          <div className="mt-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4 flex items-center justify-between">
            <p className="text-sm text-orange-300">🗑️ {pendingDeletes} pedido(s) de eliminação aguardam a sua aprovação</p>
            <Link href="/admin/delete-requests" className="rounded-lg bg-orange-500/20 px-4 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-500/30">
              Ver pedidos
            </Link>
          </div>
        )}

        {overduePayments > 0 && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-red-300">⚠ {overduePayments} pagamento(s) em atraso</p>
          </div>
        )}

        {/* Alerts */}
        {expiringContracts.length > 0 && (
          <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <h2 className="font-display text-lg font-bold text-amber-300">⚠️ Alertas de Contratos</h2>
            <ul className="mt-4 divide-y divide-white/5">
              {expiringContracts.map((c) => {
                const daysLeft = Math.ceil((c.contractEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <li key={c.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium text-paper">{c.name}</p>
                      <p className="text-mist">{c.responsible} · {c.roomNumber}</p>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${CONTRACT_STATUS_COLORS[c.contractStatus]}`}>
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

        <LeadsChart />

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-display text-lg font-bold text-paper">Próximos agendamentos</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-mist">Sem agendamentos futuros por agora.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/10">
              {upcoming.map((lead) => (
                <li key={lead.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-paper">
                      {lead.firstName} {lead.lastName}
                    </p>
                    <p className="text-mist">{lead.whatsapp}</p>
                  </div>
                  <span className="text-mist">
                    {format(lead.scheduledDate, "PPP", { locale: ptBR })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
