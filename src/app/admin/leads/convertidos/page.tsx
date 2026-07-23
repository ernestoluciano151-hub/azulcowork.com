"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConvertedLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  company: string | null;
  spaceType: string | null;
  planName: string | null;
  appointmentType: string | null;
  scheduledDate: string;
  convertedAt: string | null;
  convertedBy: string | null;
  companyRef: { id: string; name: string } | null;
  source: string | null;
  createdAt: string;
}

const PAGE_SIZE = 15;

export default function LeadsConvertidosPage() {
  const [leads, setLeads]     = useState<ConvertedLead[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [q, setQ]             = useState("");
  const [from, setFrom]       = useState("");
  const [to, setTo]           = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      status: "CONVERTIDO",
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sort: "scheduledDate",
      order: "desc",
    });
    if (q)    params.set("q", q);
    if (from) params.set("from", from);
    if (to)   params.set("to", to);

    const res = await fetch(`/api/leads?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setLeads(data.leads);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, q, from, to]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  function exportCsv() {
    const params = new URLSearchParams({ status: "CONVERTIDO" });
    if (q) params.set("q", q);
    window.open(`/api/leads/export?${params.toString()}`, "_blank");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <a href="/admin/leads" className="text-mist hover:text-paper text-sm">← Leads</a>
          </div>
          <h1 className="font-display text-2xl font-bold text-paper mt-1">Leads Convertidos</h1>
          <p className="mt-1 text-sm text-mist">{total} lead(s) convertido(s).</p>
        </div>
        <button
          onClick={exportCsv}
          className="focus-ring rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-paper hover:bg-white/5"
        >
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <input
          type="text"
          placeholder="Pesquisar nome, email, tel…"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          className="focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper placeholder:text-mist w-64"
        />
        <input
          type="date"
          value={from}
          onChange={e => { setFrom(e.target.value); setPage(1); }}
          className="focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
        />
        <span className="self-center text-mist text-sm">até</span>
        <input
          type="date"
          value={to}
          onChange={e => { setTo(e.target.value); setPage(1); }}
          className="focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
        />
        {(q || from || to) && (
          <button
            onClick={() => { setQ(""); setFrom(""); setTo(""); setPage(1); }}
            className="h-9 rounded-lg px-3 text-sm text-mist hover:text-paper"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-mist uppercase tracking-wider">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Empresa / Plano</th>
              <th className="px-4 py-3">Empresa CRM</th>
              <th className="px-4 py-3">Visita agendada</th>
              <th className="px-4 py-3">Convertido em</th>
              <th className="px-4 py-3">Convertido por</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-mist">A carregar…</td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-mist">
                  Nenhum lead convertido encontrado.
                </td>
              </tr>
            ) : leads.map((lead, i) => (
              <tr
                key={lead.id}
                className={`border-b border-white/5 hover:bg-white/4 transition-colors ${i % 2 === 0 ? "" : "bg-white/2"}`}
              >
                <td className="px-4 py-3 font-medium text-paper">
                  {lead.firstName} {lead.lastName}
                </td>
                <td className="px-4 py-3 text-mist">
                  <div>{lead.email}</div>
                  <div className="text-xs">{lead.whatsapp}</div>
                </td>
                <td className="px-4 py-3 text-mist">
                  <div>{lead.company || "—"}</div>
                  {lead.planName && (
                    <div className="text-xs text-azul">{lead.planName}</div>
                  )}
                  {lead.spaceType && (
                    <div className="text-xs">{lead.spaceType}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {lead.companyRef ? (
                    <a
                      href={`/admin/erp/companies/${lead.companyRef.id}`}
                      className="text-azul hover:underline text-xs"
                    >
                      {lead.companyRef.name}
                    </a>
                  ) : (
                    <span className="text-mist text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-mist text-xs">
                  {format(new Date(lead.scheduledDate), "dd MMM yyyy", { locale: ptBR })}
                </td>
                <td className="px-4 py-3 text-mist text-xs">
                  {lead.convertedAt
                    ? format(new Date(lead.convertedAt), "dd MMM yyyy HH:mm", { locale: ptBR })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-mist text-xs">
                  {lead.convertedBy || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-mist">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5 disabled:opacity-40"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5 disabled:opacity-40"
            >
              Seguinte →
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
