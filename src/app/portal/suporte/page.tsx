"use client";

/**
 * /portal/suporte — Lista de tickets de suporte (VOL09)
 *
 * Consome: GET /api/portal/support/tickets
 */

import { useEffect, useState, useCallback } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import Link from "next/link";

interface Ticket {
  id:          string;
  number:      string;
  subject:     string;
  status:      string;
  priority:    string;
  category:    string;
  createdAt:   string;
  updatedAt:   string;
  resolvedAt:  string | null;
  _count: { messages: number };
}

interface Pagination {
  page: number; limit: number; total: number; pages: number;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-AO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  OPEN:         { label: "Aberto",      cls: "bg-blue-100 text-blue-700" },
  IN_PROGRESS:  { label: "Em Curso",    cls: "bg-amber-100 text-amber-700" },
  PENDING_USER: { label: "Aguarda",     cls: "bg-purple-100 text-purple-700" },
  RESOLVED:     { label: "Resolvido",   cls: "bg-green-100 text-green-700" },
  CLOSED:       { label: "Fechado",     cls: "bg-gray-100 text-gray-500" },
  CANCELLED:    { label: "Cancelado",   cls: "bg-gray-100 text-gray-400" },
};

const PRIORITY_STYLE: Record<string, { label: string; cls: string }> = {
  LOW:      { label: "Baixa",    cls: "text-gray-500" },
  NORMAL:   { label: "Normal",   cls: "text-blue-600" },
  HIGH:     { label: "Alta",     cls: "text-amber-600" },
  URGENT:   { label: "Urgente",  cls: "text-red-600 font-semibold" },
};

function SuporteContent() {
  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [page,       setPage]       = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res  = await fetch(`/api/portal/support/tickets?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar tickets.");
      setTickets(json.data ?? []);
      setPagination(json.pagination);
    } catch {
      setError("Não foi possível carregar os tickets de suporte.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Suporte</h1>
        <Link
          href="/portal/suporte/novo"
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
        >
          + Novo Ticket
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Todos os estados</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">
          {pagination ? `${pagination.total} ticket${pagination.total !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-10 text-red-600 text-sm">{error}</div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">💬</div>
          <div className="text-gray-500 text-sm mb-4">
            Nenhum ticket de suporte encontrado.
          </div>
          <Link
            href="/portal/suporte/novo"
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Abrir primeiro ticket
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const st  = STATUS_STYLE[t.status]   ?? { label: t.status,   cls: "bg-gray-100 text-gray-600" };
            const pri = PRIORITY_STYLE[t.priority] ?? { label: t.priority, cls: "text-gray-600" };
            return (
              <Link
                key={t.id}
                href={`/portal/suporte/${t.id}`}
                className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs text-gray-400">{t.number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>
                        {st.label}
                      </span>
                      <span className={`text-xs ${pri.cls}`}>
                        {pri.label}
                      </span>
                    </div>
                    <div className="font-medium text-gray-900 truncate">{t.subject}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t.category} · Criado {fmtDate(t.createdAt)}
                      {t._count.messages > 0 && ` · ${t._count.messages} mensagem${t._count.messages !== 1 ? "s" : ""}`}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {fmtDate(t.updatedAt)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50"
          >
            ← Anterior
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">{page} / {pagination.pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages || loading}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50"
          >
            Seguinte →
          </button>
        </div>
      )}
    </div>
  );
}

export default function PortalSuportePage() {
  return (
    <PortalLayout>
      <SuporteContent />
    </PortalLayout>
  );
}
