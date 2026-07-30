"use client";

/**
 * /admin/erp/despesas — Gestão de Despesas ERP (VOL02)
 *
 * Lista despesas com filtros por estado.
 * Permite aprovar, rejeitar, pagar e cancelar despesas.
 * VOL12 — Sprint VOL12-3
 */

import { useEffect, useState, useCallback } from "react";

type Expense = {
  id:          string;
  description: string;
  status:      string;
  amount:      number;
  expenseDate: string;
  paidAt:      string | null;
  receiptUrl:  string | null;
  notes:       string | null;
  category?:   { name: string } | null;
  costCenter?: { name: string } | null;
  createdAt:   string;
};

type Pagination = { page: number; limit: number; total: number; pages: number };

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-yellow-500/20 text-yellow-300",
  APPROVED:  "bg-blue-500/20 text-blue-300",
  PAID:      "bg-emerald-500/20 text-emerald-300",
  REJECTED:  "bg-red-500/20 text-red-300",
  CANCELLED: "bg-gray-600/20 text-gray-400",
};

const STATUS_PT: Record<string, string> = {
  PENDING: "Pendente", APPROVED: "Aprovada", PAID: "Paga",
  REJECTED: "Rejeitada", CANCELLED: "Cancelada",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Luanda" });
}

function fmtKz(n: number): string {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(n);
}

export default function DespesasPage() {
  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage]             = useState(1);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) sp.set("status", statusFilter);
      const res = await fetch(`/api/erp/expenses?${sp}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { expenses: Expense[]; pagination: Pagination };
      setExpenses(data.expenses ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 });
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { void fetchExpenses(); }, [fetchExpenses]);

  async function doAction(id: string, action: "approve" | "reject" | "pay" | "cancel") {
    setActing(id + action);
    try {
      const res = await fetch(`/api/erp/expenses/${id}/${action}`, { method: "POST" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { alert(data.error ?? "Erro"); return; }
      void fetchExpenses();
    } catch { alert("Erro de rede"); }
    finally { setActing(null); }
  }

  const totalPendente = expenses
    .filter(e => e.status === "PENDING" || e.status === "APPROVED")
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-slate-200 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">💸 Despesas</h1>
          <p className="text-slate-400 text-sm mt-1">Registo, aprovação e pagamento de despesas operacionais.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">A aprovar/pagar (vista)</p>
          <p className="text-lg font-bold text-red-400">{fmtKz(totalPendente)}</p>
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
          {Object.entries(STATUS_PT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="ml-auto text-slate-400 text-sm self-center">
          {pagination.total} despesa{pagination.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabela */}
      <div className="bg-gray-900 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">A carregar...</div>
        ) : expenses.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400">Nenhuma despesa encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Centro Custo</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Pago em</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 font-medium text-white max-w-[200px] truncate">{e.description}</td>
                  <td className="px-4 py-3 text-slate-400">{e.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{e.costCenter?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[e.status] ?? ""}`}>
                      {STATUS_PT[e.status] ?? e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{fmtDate(e.expenseDate)}</td>
                  <td className="px-4 py-3 text-slate-300">{fmtDate(e.paidAt)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-white">{fmtKz(e.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-center">
                      {e.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => doAction(e.id, "approve")}
                            disabled={acting === e.id + "approve"}
                            className="px-2 py-1 rounded text-xs bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 transition disabled:opacity-50"
                          >
                            {acting === e.id + "approve" ? "…" : "Aprovar"}
                          </button>
                          <button
                            onClick={() => { if (confirm("Rejeitar?")) doAction(e.id, "reject"); }}
                            disabled={acting === e.id + "reject"}
                            className="px-2 py-1 rounded text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 transition disabled:opacity-50"
                          >
                            {acting === e.id + "reject" ? "…" : "Rejeitar"}
                          </button>
                        </>
                      )}
                      {e.status === "APPROVED" && (
                        <button
                          onClick={() => doAction(e.id, "pay")}
                          disabled={acting === e.id + "pay"}
                          className="px-2 py-1 rounded text-xs bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 transition disabled:opacity-50"
                        >
                          {acting === e.id + "pay" ? "…" : "Marcar Paga"}
                        </button>
                      )}
                      {(e.status === "PENDING" || e.status === "APPROVED") && (
                        <button
                          onClick={() => { if (confirm("Cancelar?")) doAction(e.id, "cancel"); }}
                          disabled={acting === e.id + "cancel"}
                          className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-400 hover:bg-gray-600 transition disabled:opacity-50"
                        >
                          {acting === e.id + "cancel" ? "…" : "Cancelar"}
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
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition">← Anterior</button>
            <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition">Seguinte →</button>
          </div>
        </div>
      )}
    </div>
  );
}
