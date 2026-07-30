"use client";

/**
 * /admin/erp/fluxo-caixa — Fluxo de Caixa ERP (VOL02)
 *
 * Exibe KPIs de caixa + movimentos do mês actual + projecção.
 * Consome /api/erp/cashflow/kpis + /api/erp/cashflow + /api/erp/cashflow/projection
 * VOL12 — Sprint VOL12-3
 */

import { useEffect, useState } from "react";

type CashKpis = {
  currentBalance:   number;
  totalInflows:     number;
  totalOutflows:    number;
  pendingInflows:   number;
  pendingOutflows:  number;
  netCashFlow:      number;
  period:           string;
};

type CashMovement = {
  id:          string;
  type:        string;
  description: string;
  amount:      number;
  movementDate: string;
  isProjected: boolean;
  entityType?: string | null;
  entityId?:   string | null;
};

type Projection = {
  month:          string;
  projectedInflow: number;
  projectedOutflow: number;
  projectedBalance: number;
};

function fmtKz(n: number): string {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Luanda" });
}

export default function FluxoCaixaPage() {
  const [kpis, setKpis]               = useState<CashKpis | null>(null);
  const [movements, setMovements]     = useState<CashMovement[]>([]);
  const [projection, setProjection]   = useState<Projection[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<"movimentos" | "projecao">("movimentos");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/erp/cashflow/kpis").then(r => r.ok ? r.json() : null),
      fetch("/api/erp/cashflow?pageSize=50").then(r => r.ok ? r.json() : null),
      fetch("/api/erp/cashflow/projection").then(r => r.ok ? r.json() : null),
    ]).then(([k, m, p]) => {
      if (k) setKpis(k as CashKpis);
      if (m) setMovements((m as { movements: CashMovement[] }).movements ?? []);
      if (p) setProjection((p as { projection: Projection[] }).projection ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-slate-200 p-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">📈 Fluxo de Caixa</h1>
        <p className="text-slate-400 text-sm mt-1">Posição actual de caixa e projecção de movimentos.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">A carregar...</div>
      ) : (
        <>
          {/* KPIs */}
          {kpis && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {[
                { label: "Saldo Actual",      value: fmtKz(kpis.currentBalance),   color: kpis.currentBalance >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Entradas",           value: fmtKz(kpis.totalInflows),     color: "text-emerald-300" },
                { label: "Saídas",             value: fmtKz(kpis.totalOutflows),    color: "text-red-300" },
                { label: "Entradas Pendentes", value: fmtKz(kpis.pendingInflows),   color: "text-yellow-300" },
                { label: "Saídas Pendentes",   value: fmtKz(kpis.pendingOutflows),  color: "text-orange-300" },
                { label: "Cash Flow Líquido",  value: fmtKz(kpis.netCashFlow),      color: kpis.netCashFlow >= 0 ? "text-blue-300" : "text-red-400" },
              ].map(k => (
                <div key={k.label} className="bg-gray-900 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{k.label}</p>
                  <p className={`text-lg font-bold font-mono ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {(["movimentos", "projecao"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "px-4 py-2 rounded-lg text-sm font-medium transition",
                  tab === t ? "bg-blue-600 text-white" : "bg-gray-800 text-slate-400 hover:bg-gray-700",
                ].join(" ")}
              >
                {t === "movimentos" ? "Movimentos" : "Projecção"}
              </button>
            ))}
          </div>

          {/* Movimentos */}
          {tab === "movimentos" && (
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              {movements.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-400">Sem movimentos.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Data</th>
                      <th className="px-4 py-3 text-left">Descrição</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-center">Projec.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {movements.map(m => (
                      <tr key={m.id} className={`hover:bg-gray-800/50 transition ${m.isProjected ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3 text-slate-300">{fmtDate(m.movementDate)}</td>
                        <td className="px-4 py-3 text-white">{m.description}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            m.type === "INFLOW" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                          }`}>
                            {m.type === "INFLOW" ? "Entrada" : "Saída"}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${
                          m.type === "INFLOW" ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {m.type === "INFLOW" ? "+" : "-"}{fmtKz(m.amount)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500">
                          {m.isProjected ? "~" : "✓"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Projecção */}
          {tab === "projecao" && (
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              {projection.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-400">Sem dados de projecção.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Mês</th>
                      <th className="px-4 py-3 text-right">Entradas Proj.</th>
                      <th className="px-4 py-3 text-right">Saídas Proj.</th>
                      <th className="px-4 py-3 text-right">Saldo Proj.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {projection.map(p => (
                      <tr key={p.month} className="hover:bg-gray-800/50 transition">
                        <td className="px-4 py-3 font-medium text-white">{p.month}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">+{fmtKz(p.projectedInflow)}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-400">-{fmtKz(p.projectedOutflow)}</td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${
                          p.projectedBalance >= 0 ? "text-blue-300" : "text-red-400"
                        }`}>{fmtKz(p.projectedBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
