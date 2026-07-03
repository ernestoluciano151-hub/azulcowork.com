"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatKz } from "@/lib/currency";
import { format } from "date-fns";

type SummaryData = {
  receitaMes: number;
  receitaAnual: number;
  totalRecebido: number;
  totalPendente: number;
  totalAtrasado: number;
  mrr: number;
  previsao: number;
  empresasEmAtraso: number;
  caixaAtual: number;
  totalContratado: number;
  totalEmDivida: number;
  receitaMensal: { month: string; receita: number; despesa: number }[];
  despesasPorCategoria: { category: string; total: number }[];
  alertasVencer: AlertPayment[];
  alertasAtrasados: AlertPayment[];
};

type AlertPayment = {
  id: string;
  companyId: string;
  company: { name: string };
  dueDate: string;
  amount: number;
  status: string;
};

export default function FinanceDashboard() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/finance/summary");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function generateMonthly() {
    setGenerating(true);
    const res = await fetch("/api/payments/generate-monthly", { method: "POST" });
    const d = await res.json();
    setGenerating(false);
    setToast({ msg: d.message || "Concluído.", ok: res.ok });
    setTimeout(() => setToast(null), 4000);
    fetchData();
  }

  if (loading) {
    return <div className="py-16 text-center text-[#94A3B8]">A carregar dashboard...</div>;
  }

  if (!data) {
    return <div className="py-16 text-center text-red-400">Erro ao carregar dados.</div>;
  }

  const cashFlowData = data.receitaMensal.map((d) => ({
    ...d,
    saldo: d.receita - d.despesa,
  }));

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed right-6 top-6 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header action */}
      <div className="flex justify-end">
        <button
          onClick={generateMonthly}
          disabled={generating}
          className="rounded-lg bg-[#2F6FED] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E4FB8] disabled:opacity-50 transition-colors"
        >
          {generating ? "A gerar..." : "Gerar Pagamentos do Mês"}
        </button>
      </div>

      {/* Row 1 — Revenue KPIs (green) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Receita do Mês"
          value={formatKz(data.receitaMes)}
          colorClass="border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
          labelClass="text-emerald-400"
        />
        <KpiCard
          label="Receita Anual"
          value={formatKz(data.receitaAnual)}
          colorClass="border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
          labelClass="text-emerald-400"
        />
        <KpiCard
          label="MRR (Recorrente)"
          value={formatKz(data.mrr)}
          colorClass="border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
          labelClass="text-emerald-400"
        />
      </div>

      {/* Row 2 — Mixed */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Previsão de Recebimentos"
          value={formatKz(data.previsao)}
          colorClass="border-[#2F6FED]/20 bg-[#2F6FED]/5 text-[#5C8FFF]"
          labelClass="text-[#5C8FFF]"
        />
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Empresas em Atraso</p>
          <p className="mt-2 text-4xl font-bold text-red-300">{data.empresasEmAtraso}</p>
        </div>
        <KpiCard
          label="Caixa Actual (ano)"
          value={formatKz(data.caixaAtual)}
          colorClass={data.caixaAtual >= 0 ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" : "border-red-500/20 bg-red-500/5 text-red-300"}
          labelClass={data.caixaAtual >= 0 ? "text-emerald-400" : "text-red-400"}
        />
      </div>

      {/* Row 3 — Contract totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total Contratado (activo)"
          value={formatKz(data.totalContratado)}
          colorClass="border-[#2F6FED]/20 bg-[#2F6FED]/5 text-[#5C8FFF]"
          labelClass="text-[#5C8FFF]"
        />
        <KpiCard
          label="Total Recebido (geral)"
          value={formatKz(data.totalRecebido)}
          colorClass="border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
          labelClass="text-emerald-400"
        />
        <KpiCard
          label="Saldo em Dívida"
          value={formatKz(data.totalEmDivida)}
          colorClass={data.totalEmDivida > 0 ? "border-red-500/20 bg-red-500/5 text-red-300" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"}
          labelClass={data.totalEmDivida > 0 ? "text-red-400" : "text-emerald-400"}
        />
      </div>

      {/* Row 4 — All-time totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total Pendente (geral)"
          value={formatKz(data.totalPendente)}
          colorClass="border-amber-500/20 bg-amber-500/5 text-amber-300"
          labelClass="text-amber-400"
        />
        <KpiCard
          label="Total em Atraso (geral)"
          value={formatKz(data.totalAtrasado)}
          colorClass="border-red-500/20 bg-red-500/5 text-red-300"
          labelClass="text-red-400"
        />
        <KpiCard
          label="Caixa Actual (ano)"
          value={formatKz(data.caixaAtual)}
          colorClass={data.caixaAtual >= 0 ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" : "border-red-500/20 bg-red-500/5 text-red-300"}
          labelClass={data.caixaAtual >= 0 ? "text-emerald-400" : "text-red-400"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar chart: Receita vs Despesas */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-4 font-semibold text-[#F5F7FA]">Receita vs Despesas — Últimos 12 meses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.receitaMensal} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#101a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                labelStyle={{ color: "#94A3B8" }}
                formatter={(value: unknown) => [formatKz(Number(value)), ""]}
              />
              <Legend wrapperStyle={{ color: "#94A3B8", fontSize: 12 }} />
              <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line chart: Cash flow */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-4 font-semibold text-[#F5F7FA]">Fluxo de Caixa — Últimos 12 meses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={cashFlowData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#101a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                labelStyle={{ color: "#94A3B8" }}
                formatter={(value: unknown) => [formatKz(Number(value)), ""]}
              />
              <Legend wrapperStyle={{ color: "#94A3B8", fontSize: 12 }} />
              <Line type="monotone" dataKey="saldo" name="Saldo Líquido" stroke="#2F6FED" strokeWidth={2} dot={{ fill: "#2F6FED", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-amber-300">
            <span>⚠️</span> A vencer em 7 dias
          </h3>
          {data.alertasVencer.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">Nenhum pagamento a vencer nos próximos 7 dias.</p>
          ) : (
            <div className="space-y-2">
              {data.alertasVencer.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-[#F5F7FA]">{p.company.name}</p>
                    <p className="text-xs text-[#94A3B8]">Vence: {format(new Date(p.dueDate), "dd/MM/yyyy")}</p>
                  </div>
                  <span className="text-sm font-bold text-amber-300">{formatKz(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-red-300">
            <span>🔴</span> Em atraso
          </h3>
          {data.alertasAtrasados.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">Nenhum pagamento em atraso.</p>
          ) : (
            <div className="space-y-2">
              {data.alertasAtrasados.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-[#F5F7FA]">{p.company.name}</p>
                    <p className="text-xs text-[#94A3B8]">Venceu: {format(new Date(p.dueDate), "dd/MM/yyyy")}</p>
                  </div>
                  <span className="text-sm font-bold text-red-300">{formatKz(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, colorClass, labelClass,
}: {
  label: string; value: string; colorClass: string; labelClass: string;
}) {
  return (
    <div className={`rounded-xl border p-5 ${colorClass}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}>{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
