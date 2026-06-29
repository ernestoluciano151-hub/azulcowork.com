export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/admin/Sidebar";
import StatsCard from "@/components/admin/StatsCard";
import LeadsChart from "@/components/admin/LeadsChart";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
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
  const weekStart = startOfWeek(now);
  const in60 = new Date(now); in60.setDate(in60.getDate() + 60);

  const [total, today, week, upcoming, totalCompanies, expiringContracts, overduePayments, rooms] = await Promise.all([
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
    prisma.meetingRoom.findMany({ include: { _count: true } })
  ]);

  const availableRooms = rooms.filter((r) => r.status === "DISPONIVEL").length;
  const occupiedRooms = rooms.filter((r) => r.status !== "DISPONIVEL").length;

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="font-display text-2xl font-bold text-paper">Dashboard</h1>
        <p className="mt-1 text-sm text-mist">Visão geral do CRM.</p>

        {/* Leads stats */}
        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-mist">Leads</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatsCard label="Total de leads" value={total} />
          <StatsCard label="Leads hoje" value={today} />
          <StatsCard label="Leads esta semana" value={week} />
        </div>

        {/* Company stats */}
        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-mist">Empresas & Salas</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard label="Total de empresas" value={totalCompanies} />
          <StatsCard label="Contratos a expirar (60d)" value={expiringContracts.length} />
          <StatsCard label="Pagamentos em atraso" value={overduePayments} />
          <StatsCard label="Salas disponíveis" value={availableRooms} />
        </div>

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
