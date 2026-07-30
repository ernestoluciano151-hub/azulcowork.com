"use client";

/**
 * /admin/erp/contratos — Gestão de Contratos de Coworking (ERP VOL02)
 *
 * Lista todos os contratos com filtros por estado e empresa.
 * Permite activar, suspender e terminar contratos.
 * VOL12 — Sprint VOL12-2
 */

import { useEffect, useState, useCallback } from "react";

type Contract = {
  id:           string;
  planType:     string;
  status:       string;
  startDate:    string;
  endDate:      string | null;
  monthlyValue: number;
  autoRenew:    boolean;
  createdAt:    string;
  company: { id: string; name: string };
  _count?: { rentSchedules: number };
};

type Pagination = { page: number; limit: number; total: number; pages: number };

const STATUS_COLORS: Record<string, string> = {
  DRAFT:       "bg-gray-500/20 text-gray-300",
  ACTIVE:      "bg-emerald-500/20 text-emerald-300",
  SUSPENDED:   "bg-yellow-500/20 text-yellow-300",
  TERMINATED:  "bg-red-500/20 text-red-300",
  EXPIRED:     "bg-orange-500/20 text-orange-300",
};

const STATUS_PT: Record<string, string> = {
  DRAFT: "Rascunho", ACTIVE: "Activo", SUSPENDED: "Suspenso",
  TERMINATED: "Terminado", EXPIRED: "Expirado",
};

const PLAN_PT: Record<string, string> = {
  DEDICATED_DESK: "Mesa Dedicada", HOT_DESK: "Hot Desk",
  PRIVATE_OFFICE: "Escritório Privado", VIRTUAL_OFFICE: "Escritório Virtual",
  CUSTOM: "Personalizado",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Luanda" });
}

function fmtKz(n: number): string {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(n);
}

export default function ContratosPage() {
  const [contracts, setContracts]   = useState<Contract[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage]             = useState(1);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) sp.set("status", statusFilter);
      const res = await fetch(`/api/erp/contracts?${sp}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { contracts: Contract[]; pagination: Pagination };
      setContracts(data.contracts ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 });
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { void fetchContracts(); }, [fetchContracts]);

  async function doAction(id: string, action: "activate" | "suspend" | "terminate") {
    setActing(id + action);
    try {
      const res = await fetch(`/api/erp/contracts/${id}/${action}`, { method: "POST" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { alert(data.error ?? "Erro"); return; }
      void fetchContracts();
    } catch { alert("Erro de rede"); }
    finally { setActing(null); }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-slate-200 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">📋 Contratos de Coworking</h1>
          <p className="text-slate-400 text-sm mt-1">Gestão completa de contratos e parcelas de renda.</p>
        </div>
        <div className="text-slate-400 text-sm">
          {pagination.total} contrato{pagination.total !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 rounded-xl p-4 mb-6 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">Todos os estados</option>
          {Object.entries(STATUS_PT).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-gray-900 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">A carregar...</div>
        ) : contracts.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400">Nenhum contrato encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-left">Plano</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Renda/mês</th>
                <th className="px-4 py-3 text-left">Início</th>
                <th className="px-4 py-3 text-left">Fim</th>
                <th className="px-4 py-3 text-center">Auto-Renovar</th>
                <th className="px-4 py-3 text-center">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 font-medium text-white">{c.company.name}</td>
                  <td className="px-4 py-3 text-slate-300">{PLAN_PT[c.planType] ?? c.planType}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? ""}`}>
                      {STATUS_PT[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">{fmtKz(c.monthlyValue)}</td>
                  <td className="px-4 py-3 text-slate-300">{fmtDate(c.startDate)}</td>
                  <td className="px-4 py-3 text-slate-300">{fmtDate(c.endDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={c.autoRenew ? "text-emerald-400" : "text-slate-500"}>
                      {c.autoRenew ? "✓" : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-center">
                      {c.status === "DRAFT" && (
                        <button
                          onClick={() => doAction(c.id, "activate")}
                          disabled={acting === c.id + "activate"}
                          className="px-2 py-1 rounded text-xs bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 transition disabled:opacity-50"
                        >
                          {acting === c.id + "activate" ? "…" : "Activar"}
                        </button>
                      )}
                      {c.status === "ACTIVE" && (
                        <button
                          onClick={() => doAction(c.id, "suspend")}
                          disabled={acting === c.id + "suspend"}
                          className="px-2 py-1 rounded text-xs bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/50 transition disabled:opacity-50"
                        >
                          {acting === c.id + "suspend" ? "…" : "Suspender"}
                        </button>
                      )}
                      {(c.status === "ACTIVE" || c.status === "SUSPENDED") && (
                        <button
                          onClick={() => { if (confirm("Terminar este contrato?")) doAction(c.id, "terminate"); }}
                          disabled={acting === c.id + "terminate"}
                          className="px-2 py-1 rounded text-xs bg-red-600/30 text-red-300 hover:bg-red-600/50 transition disabled:opacity-50"
                        >
                          {acting === c.id + "terminate" ? "…" : "Terminar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
          <span>Página {pagination.page} de {pagination.pages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition"
            >← Anterior</button>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition"
            >Seguinte →</button>
          </div>
        </div>
      )}
    </div>
  );
}
