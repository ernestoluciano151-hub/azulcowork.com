"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import LeadModal, { Lead } from "@/components/admin/LeadModal";
import DeleteRequestModal from "@/components/admin/DeleteRequestModal";
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

const APPOINTMENT_TYPES = ["ALL", "Pedido de contacto", "Visita ao Cowork", "Outro"];

const PAGE_SIZE = 10;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [appointmentType, setAppointmentType] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [creatingLead, setCreatingLead] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; label: string } | null>(null);

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
    if (appointmentType !== "ALL") params.set("appointmentType", appointmentType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const res = await fetch(`/api/leads?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setLeads(data.leads);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, q, status, appointmentType, from, to, order]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  function exportCsv() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "ALL") params.set("status", status);
    window.open(`/api/leads/export?${params.toString()}`, "_blank");
  }

  function exportXlsx() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "ALL") params.set("status", status);
    window.open(`/api/leads/export-xlsx?${params.toString()}`, "_blank");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminLayout>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-paper">Leads</h1>
            <p className="mt-1 text-sm text-mist">{total} lead(s) encontrados.</p>
            <a
              href="/admin/leads/convertidos"
              className="mt-1 inline-block text-xs text-azul hover:underline"
            >
              Ver Leads Convertidos →
            </a>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCreatingLead(true)}
              className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-medium text-white hover:bg-azul-dim"
            >
              + Novo Lead
            </button>
            <button
              onClick={exportCsv}
              className="focus-ring rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-paper hover:bg-white/5"
            >
              Exportar CSV
            </button>
            <button
              onClick={exportXlsx}
              className="focus-ring rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20"
            >
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <input
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
            placeholder="Pesquisar por nome, e-mail ou WhatsApp..."
            className="focus-ring min-w-[220px] flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          />
          <select
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
            className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            <option value="ALL">Todos os estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={appointmentType}
            onChange={(e) => { setPage(1); setAppointmentType(e.target.value); }}
            className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            {APPOINTMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t === "ALL" ? "Todos os tipos" : t}</option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => { setPage(1); setFrom(e.target.value); }}
            className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => { setPage(1); setTo(e.target.value); }}
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
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Data agendada</th>
                <th className="px-4 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-mist">A carregar...</td>
                </tr>
              )}
              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-mist">
                    Nenhum lead encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}
              {leads.map((lead) => (
                <tr key={lead.id} className="text-paper">
                  <td className="px-4 py-3">{lead.firstName} {lead.lastName}</td>
                  <td className="px-4 py-3 text-mist">{lead.company || "—"}</td>
                  <td className="px-4 py-3 text-mist">{lead.email}</td>
                  <td className="px-4 py-3 text-mist">{lead.whatsapp}</td>
                  <td className="px-4 py-3">{format(new Date(lead.scheduledDate), "dd/MM/yyyy")}</td>
                  <td className="px-4 py-3 text-mist">{lead.appointmentTime || "—"}</td>
                  <td className="px-4 py-3">
                    {lead.appointmentType && (
                      <span className="rounded-full bg-azul/15 px-2 py-0.5 text-xs text-azul-glow">
                        {lead.appointmentType}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[lead.status]}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingLead(lead)}
                        className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleteModal({ id: lead.id, label: `${lead.firstName} ${lead.lastName}` })}
                        className="rounded-lg border border-red-500/20 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                        title="Pedir eliminação"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="mt-4 flex items-center justify-between text-sm text-mist">
          <span>Página {page} de {totalPages}</span>
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

      {editingLead && (
        <LeadModal
          lead={editingLead}
          mode="edit"
          onClose={() => setEditingLead(null)}
          onSaved={() => fetchLeads()}
        />
      )}
      {creatingLead && (
        <LeadModal
          mode="create"
          onClose={() => setCreatingLead(false)}
          onSaved={() => fetchLeads()}
        />
      )}
      {deleteModal && (
        <DeleteRequestModal
          isOpen={true}
          onClose={() => setDeleteModal(null)}
          entityType="lead"
          entityId={deleteModal.id}
          entityLabel={deleteModal.label}
          onSuccess={() => { setDeleteModal(null); fetchLeads(); }}
        />
      )}
    </AdminLayout>
  );
}
