"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/admin/Sidebar";
import LeadModal, { Lead } from "@/components/admin/LeadModal";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo",
  CONTACTADO: "Contactado",
  EM_NEGOCIACAO: "Em negociação",
  CONVERTIDO: "Convertido",
  PERDIDO: "Perdido"
};

const STATUS_COLORS: Record<string, string> = {
  NOVO: "bg-blue-500/15 text-blue-300",
  CONTACTADO: "bg-amber-500/15 text-amber-300",
  EM_NEGOCIACAO: "bg-purple-500/15 text-purple-300",
  CONVERTIDO: "bg-emerald-500/15 text-emerald-300",
  PERDIDO: "bg-red-500/15 text-red-300"
};

const PAGE_SIZE = 10;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sort: "scheduledDate",
      order
    });
    if (q) params.set("q", q);
    if (status !== "ALL") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const res = await fetch(`/api/leads?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setLeads(data.leads);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, q, status, from, to, order]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  function exportCsv() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "ALL") params.set("status", status);
    window.open(`/api/leads/export?${params.toString()}`, "_blank");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-paper">Leads</h1>
            <p className="mt-1 text-sm text-mist">{total} lead(s) encontrados.</p>
          </div>
          <button
            onClick={exportCsv}
            className="focus-ring rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-paper hover:bg-white/5"
          >
            Exportar CSV
          </button>
        </div>

        {/* Filtros */}
        <div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Pesquisar por nome, e-mail ou WhatsApp..."
            className="focus-ring min-w-[220px] flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          />
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            <option value="ALL">Todos os estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
            className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
            className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          />
          <button
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            className="focus-ring rounded-lg border border-white/10 px-3 py-2 text-sm text-paper hover:bg-white/5"
            title="Ordenar por data de agendamento"
          >
            Data agendada {order === "asc" ? "↑" : "↓"}
          </button>
        </div>

        {/* Tabela */}
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-mist">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Data agendada</th>
                <th className="px-4 py-3 font-medium">Registo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-mist">
                    A carregar...
                  </td>
                </tr>
              )}
              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-mist">
                    Nenhum lead encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}
              {leads.map((lead) => (
                <tr key={lead.id} className="text-paper">
                  <td className="px-4 py-3">
                    {lead.firstName} {lead.lastName}
                  </td>
                  <td className="px-4 py-3 text-mist">{lead.email}</td>
                  <td className="px-4 py-3 text-mist">{lead.whatsapp}</td>
                  <td className="px-4 py-3">{format(new Date(lead.scheduledDate), "dd/MM/yyyy")}</td>
                  <td className="px-4 py-3 text-mist">{format(new Date(lead.createdAt), "dd/MM/yyyy")}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[lead.status]}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingLead(lead)}
                      className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="mt-4 flex items-center justify-between text-sm text-mist">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40"
            >
              Seguinte
            </button>
          </div>
        </div>
      </main>

      {editingLead && (
        <LeadModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSaved={() => fetchLeads()}
        />
      )}
    </div>
  );
}
