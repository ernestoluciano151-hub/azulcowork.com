"use client";

/**
 * /portal/faturas — Lista de faturas do Portal do Cliente (VOL09)
 *
 * Consome: GET /api/portal/invoices
 * Filtros: status, período
 */

import { useEffect, useState, useCallback } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import Link from "next/link";

interface Invoice {
  id:        string;
  number:    string;
  type:      string;
  status:    string;
  issueDate: string;
  dueDate:   string | null;
  subtotal:  number;
  taxAmount: number;
  total:     number;
  paidAt:    string | null;
}

interface Pagination {
  page:  number;
  limit: number;
  total: number;
  pages: number;
}

function fmtKz(n: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency", currency: "AOA", minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-AO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  DRAFT:           { label: "Rascunho",       cls: "bg-gray-100 text-gray-600" },
  ISSUED:          { label: "Emitida",         cls: "bg-blue-100 text-blue-700" },
  SENT:            { label: "Enviada",         cls: "bg-indigo-100 text-indigo-700" },
  PAID:            { label: "Paga",            cls: "bg-green-100 text-green-700" },
  OVERDUE:         { label: "Em Atraso",       cls: "bg-red-100 text-red-700" },
  PARTIALLY_PAID:  { label: "Parcialmente Paga", cls: "bg-amber-100 text-amber-700" },
  CANCELLED:       { label: "Cancelada",       cls: "bg-gray-100 text-gray-500" },
  VOID:            { label: "Anulada",         cls: "bg-gray-100 text-gray-400" },
};

function FaturasContent() {
  const [invoices,   setInvoices]   = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [status,     setStatus]     = useState("");
  const [page,       setPage]       = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (status) params.set("status", status);
      const res  = await fetch(`/api/portal/invoices?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar faturas.");
      setInvoices(json.data);
      setPagination(json.pagination);
    } catch {
      setError("Não foi possível carregar as faturas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Faturas</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Todos os estados</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">
          {pagination ? `${pagination.total} fatura${pagination.total !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-10 text-red-600 text-sm">{error}</div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-gray-500 text-sm">Nenhuma fatura encontrada.</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Nº</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs hidden sm:table-cell">Data</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs hidden md:table-cell">Vencimento</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Estado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv) => {
                const st = STATUS_STYLE[inv.status] ?? { label: inv.status, cls: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-800">{inv.number}</td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{fmtDate(inv.issueDate)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={inv.status === "OVERDUE" ? "text-red-600 font-medium" : "text-gray-600"}>
                        {fmtDate(inv.dueDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {fmtKz(inv.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/portal/faturas/${inv.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50"
          >
            ← Anterior
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">
            {page} / {pagination.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50"
          >
            Seguinte →
          </button>
        </div>
      )}
    </div>
  );
}

export default function PortalFaturasPage() {
  return (
    <PortalLayout>
      <FaturasContent />
    </PortalLayout>
  );
}
