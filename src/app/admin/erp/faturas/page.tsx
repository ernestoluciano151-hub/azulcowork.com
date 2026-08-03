"use client";

/**
 * /admin/erp/faturas — Gestão de Faturas ERP (VOL02)
 *
 * Lista faturas com filtros por estado e tipo.
 * Permite emitir (DRAFT→ISSUED), enviar por email e anular faturas.
 * VOL12 — Sprint VOL12-2
 */

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

type Invoice = {
  id:        string;
  number:    string;
  type:      string;
  status:    string;
  issueDate: string;
  dueDate:   string;
  subtotal:  number;
  taxAmount: number;
  total:     number;
  notes:     string | null;
  company:   { id: string; name: string } | null;
  _count?:   { payments: number };
};

type Pagination = { page: number; limit: number; total: number; pages: number };

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    "bg-gray-500/20 text-gray-300",
  ISSUED:   "bg-blue-500/20 text-blue-300",
  SENT:     "bg-indigo-500/20 text-indigo-300",
  PAID:     "bg-emerald-500/20 text-emerald-300",
  OVERDUE:  "bg-red-500/20 text-red-300",
  VOID:     "bg-gray-600/20 text-gray-500",
};

const STATUS_PT: Record<string, string> = {
  DRAFT: "Rascunho", ISSUED: "Emitida", SENT: "Enviada",
  PAID: "Paga", OVERDUE: "Em Atraso", VOID: "Anulada",
};

const TYPE_PT: Record<string, string> = {
  COWORKING: "Coworking", ROOM_BOOKING: "Sala Reunião", SERVICE: "Serviço",
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Luanda" });
}

function fmtKz(n: number): string {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(n);
}

function FaturasPageInner() {
  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter]     = useState("");
  const [page, setPage]             = useState(1);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) sp.set("status", statusFilter);
      if (typeFilter)   sp.set("type", typeFilter);
      const res = await fetch(`/api/erp/invoices?${sp}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { invoices: Invoice[]; pagination: Pagination };
      setInvoices(data.invoices ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 });
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => { void fetchInvoices(); }, [fetchInvoices]);

  async function doAction(id: string, action: "issue" | "void" | "send") {
    setActing(id + action);
    try {
      const res = await fetch(`/api/erp/invoices/${id}/${action}`, { method: "POST" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { alert(data.error ?? "Erro"); return; }
      void fetchInvoices();
    } catch { alert("Erro de rede"); }
    finally { setActing(null); }
  }

  const totaisVisiveis = invoices.reduce((acc, inv) => {
    acc.total += inv.total;
    acc.iva   += inv.taxAmount;
    return acc;
  }, { total: 0, iva: 0 });

  return (
    <div className="bg-gray-950 text-slate-200 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🧾 Faturas</h1>
          <p className="text-slate-400 text-sm mt-1">Emissão, envio e gestão de faturas ERP.</p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-xs text-slate-500">Total (vista)</p>
            <p className="text-lg font-bold text-white">{fmtKz(totaisVisiveis.total)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">IVA 14%</p>
            <p className="text-lg font-bold text-yellow-400">{fmtKz(totaisVisiveis.iva)}</p>
          </div>
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
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_PT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="ml-auto text-slate-400 text-sm self-center">
          {pagination.total} fatura{pagination.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabela */}
      <div className="bg-gray-900 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">A carregar...</div>
        ) : invoices.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400">Nenhuma fatura encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Nº Fatura</th>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Emissão</th>
                <th className="px-4 py-3 text-left">Vencimento</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">IVA 14%</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 font-mono text-xs text-white">{inv.number}</td>
                  <td className="px-4 py-3 text-slate-300">{inv.company?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{TYPE_PT[inv.type] ?? inv.type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] ?? ""}`}>
                      {STATUS_PT[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{fmtDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 text-slate-300">{fmtDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">{fmtKz(inv.subtotal)}</td>
                  <td className="px-4 py-3 text-right font-mono text-yellow-400">{fmtKz(inv.taxAmount)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-white">{fmtKz(inv.total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-center">
                      {inv.status === "DRAFT" && (
                        <button
                          onClick={() => doAction(inv.id, "issue")}
                          disabled={acting === inv.id + "issue"}
                          className="px-2 py-1 rounded text-xs bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 transition disabled:opacity-50"
                        >
                          {acting === inv.id + "issue" ? "…" : "Emitir"}
                        </button>
                      )}
                      {(inv.status === "ISSUED" || inv.status === "SENT" || inv.status === "OVERDUE") && (
                        <button
                          onClick={() => doAction(inv.id, "send")}
                          disabled={acting === inv.id + "send"}
                          className="px-2 py-1 rounded text-xs bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 transition disabled:opacity-50"
                        >
                          {acting === inv.id + "send" ? "…" : "Enviar"}
                        </button>
                      )}
                      {(inv.status === "ISSUED" || inv.status === "SENT") && (
                        <button
                          onClick={() => { if (confirm("Anular esta fatura?")) doAction(inv.id, "void"); }}
                          disabled={acting === inv.id + "void"}
                          className="px-2 py-1 rounded text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 transition disabled:opacity-50"
                        >
                          {acting === inv.id + "void" ? "…" : "Anular"}
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

// Navegação consistente: sidebar persistente à esquerda, conteúdo à direita
export default function FaturasPage() {
  return (
    <AdminLayout>
      <FaturasPageInner />
    </AdminLayout>
  );
}
