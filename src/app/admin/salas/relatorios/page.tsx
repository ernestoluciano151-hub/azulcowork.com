"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/components/admin/Sidebar";
import { formatKz } from "@/lib/currency";

type Plan = { id: string; name: string };
type MonthRow = { month: string; reservations: number; hours: number; revenue: number };
type PlanRow  = { planName: string; reservations: number; hours: number; revenue: number; coffeeBreaks: number };
type ClientRow = { name: string; reservations: number; revenue: number };

type Summary = {
  totalReservations: number;
  totalHours: number;
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
  avgHoursPerRes: number;
  avgRevenuePerRes: number;
  coffeeBreakCount: number;
  coffeeBreakPct: number;
};

type ReportData = {
  period: { from: string; to: string };
  summary: Summary;
  byMonth: MonthRow[];
  byPlan: PlanRow[];
  byPaymentStatus: Record<string, number>;
  topClients: ClientRow[];
  plans: Plan[];
};

const PAY_LABELS: Record<string, { label: string; color: string }> = {
  PAGO:      { label: "Pago",       color: "text-emerald-400" },
  PARCIAL:   { label: "Parcial",    color: "text-amber-400"   },
  PENDENTE:  { label: "Pendente",   color: "text-[#94A3B8]"   },
  FACTURADO: { label: "Facturado",  color: "text-[#5C8FFF]"   },
  ISENTO:    { label: "Isento",     color: "text-purple-400"  },
};

// ── helpers ───────────────────────────────────────────────────────────────────
function today()      { return new Date().toISOString().slice(0, 10); }
function firstOfYear(){ return `${new Date().getFullYear()}-01-01`; }

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1829] p-5">
      <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#F5F7FA]">{value}</p>
      {sub && <p className="text-xs text-[#94A3B8] mt-0.5">{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color = "bg-[#2F6FED]", right }: {
  label: string; value: number; max: number; color?: string; right: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <p className="w-28 text-xs text-[#94A3B8] truncate shrink-0">{label}</p>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <p className="w-28 text-right text-xs font-semibold text-[#F5F7FA] shrink-0">{right}</p>
    </div>
  );
}

export default function SalaReportsPage() {
  const [from, setFrom]       = useState(firstOfYear());
  const [to, setTo]           = useState(today());
  const [planId, setPlanId]   = useState("");
  const [data, setData]       = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to });
      if (planId) qs.set("planId", planId);
      const res = await fetch(`/api/salas/reports?${qs}`);
      const json = await res.json();
      setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [from, to, planId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const s   = data?.summary;
  const maxM = Math.max(...(data?.byMonth.map(m => m.revenue) ?? [0]), 1);
  const maxP = Math.max(...(data?.byPlan.map(p => p.revenue)  ?? [0]), 1);
  const maxC = Math.max(...(data?.topClients.map(c => c.revenue) ?? [0]), 1);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B1220] text-[#F5F7FA]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#F5F7FA]">📊 Relatórios de Salas</h1>
            <p className="text-sm text-[#94A3B8] mt-0.5">Ocupação e receita por período</p>
          </div>
          <Link href="/admin/salas" className="text-sm text-[#94A3B8] hover:text-[#F5F7FA]">
            ← Salas
          </Link>
        </div>

        {/* Filtros */}
        <div className="mb-6 flex flex-wrap gap-3 items-end rounded-2xl border border-white/10 bg-[#0d1829] p-4">
          <div>
            <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">De</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Até</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Plano</label>
            <select
              value={planId}
              onChange={e => setPlanId(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA]"
            >
              <option value="">Todos os planos</option>
              {data?.plans.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="rounded-xl bg-[#2F6FED] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5C8FFF] disabled:opacity-50"
          >
            {loading ? "A carregar…" : "Actualizar"}
          </button>
        </div>

        {!data ? (
          <div className="py-20 text-center text-[#94A3B8]">A carregar relatório…</div>
        ) : (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Total de Reservas"  value={String(s!.totalReservations)} sub={`${s!.totalHours}h de ocupação`} />
              <Kpi label="Receita Total"      value={formatKz(s!.totalRevenue)}   sub={`Média ${formatKz(s!.avgRevenuePerRes)} / reserva`} />
              <Kpi label="Total Recebido"     value={formatKz(s!.totalPaid)}      sub={`${formatKz(s!.totalPending)} em dívida`} />
              <Kpi label="Coffee Break"       value={`${s!.coffeeBreakCount} (${s!.coffeeBreakPct}%)`} sub={`Média ${s!.avgHoursPerRes}h / reserva`} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Receita por mês */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1829] p-5">
                <h2 className="text-sm font-bold text-[#F5F7FA] mb-4">📅 Receita por Mês</h2>
                {data.byMonth.length === 0 ? (
                  <p className="text-sm text-[#94A3B8]">Sem dados no período.</p>
                ) : (
                  <div className="space-y-1">
                    {data.byMonth.map(m => (
                      <BarRow
                        key={m.month}
                        label={m.month}
                        value={m.revenue}
                        max={maxM}
                        right={formatKz(m.revenue)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Por plano */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1829] p-5">
                <h2 className="text-sm font-bold text-[#F5F7FA] mb-4">🏠 Receita por Plano</h2>
                {data.byPlan.length === 0 ? (
                  <p className="text-sm text-[#94A3B8]">Sem dados.</p>
                ) : (
                  <div className="space-y-1">
                    {data.byPlan.map(p => (
                      <BarRow
                        key={p.planName}
                        label={p.planName}
                        value={p.revenue}
                        max={maxP}
                        color="bg-[#5C8FFF]"
                        right={`${formatKz(p.revenue)} (${p.reservations} res.)`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Estado de pagamento */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1829] p-5">
                <h2 className="text-sm font-bold text-[#F5F7FA] mb-4">💳 Estado de Pagamento</h2>
                <div className="space-y-2">
                  {Object.entries(data.byPaymentStatus).map(([status, count]) => {
                    const cfg = PAY_LABELS[status] ?? { label: status, color: "text-[#94A3B8]" };
                    const pct = s!.totalReservations > 0
                      ? Math.round((count / s!.totalReservations) * 100)
                      : 0;
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#2F6FED] rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#94A3B8] w-16 text-right">{count} ({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top clientes */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1829] p-5">
                <h2 className="text-sm font-bold text-[#F5F7FA] mb-4">🏆 Top Clientes</h2>
                {data.topClients.length === 0 ? (
                  <p className="text-sm text-[#94A3B8]">Sem dados.</p>
                ) : (
                  <div className="space-y-1">
                    {data.topClients.map((c, i) => (
                      <BarRow
                        key={c.name + i}
                        label={c.name}
                        value={c.revenue}
                        max={maxC}
                        color="bg-emerald-500"
                        right={`${formatKz(c.revenue)} (${c.reservations}×)`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tabela detalhe por mês */}
            {data.byMonth.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#0d1829] overflow-hidden">
                <div className="p-5 border-b border-white/10">
                  <h2 className="text-sm font-bold text-[#F5F7FA]">📋 Detalhe Mensal</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[#94A3B8] text-xs uppercase">
                        <th className="px-5 py-3 text-left">Mês</th>
                        <th className="px-5 py-3 text-right">Reservas</th>
                        <th className="px-5 py-3 text-right">Horas</th>
                        <th className="px-5 py-3 text-right">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byMonth.map(m => (
                        <tr key={m.month} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-5 py-3 text-[#F5F7FA] capitalize">{m.month}</td>
                          <td className="px-5 py-3 text-right text-[#94A3B8]">{m.reservations}</td>
                          <td className="px-5 py-3 text-right text-[#94A3B8]">{m.hours.toFixed(1)}h</td>
                          <td className="px-5 py-3 text-right font-semibold text-[#F5F7FA]">{formatKz(m.revenue)}</td>
                        </tr>
                      ))}
                      <tr className="bg-white/5 font-bold">
                        <td className="px-5 py-3 text-[#F5F7FA]">Total</td>
                        <td className="px-5 py-3 text-right text-[#F5F7FA]">{s!.totalReservations}</td>
                        <td className="px-5 py-3 text-right text-[#F5F7FA]">{s!.totalHours}h</td>
                        <td className="px-5 py-3 text-right text-[#5C8FFF]">{formatKz(s!.totalRevenue)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
