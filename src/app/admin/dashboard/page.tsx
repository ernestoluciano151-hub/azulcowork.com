import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/admin/Sidebar";
import StatsCard from "@/components/admin/StatsCard";
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
  const diff = (day + 6) % 7; // semana começa na segunda
  x.setDate(x.getDate() - diff);
  return x;
}

export default async function DashboardPage() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);

  const [total, today, week, upcoming] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.lead.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.lead.findMany({
      where: { scheduledDate: { gte: now } },
      orderBy: { scheduledDate: "asc" },
      take: 6
    })
  ]);

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="font-display text-2xl font-bold text-paper">Dashboard</h1>
        <p className="mt-1 text-sm text-mist">Visão geral dos leads captados.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatsCard label="Total de leads" value={total} />
          <StatsCard label="Leads hoje" value={today} />
          <StatsCard label="Leads esta semana" value={week} />
        </div>

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
