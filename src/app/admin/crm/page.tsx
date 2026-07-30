"use client";

/**
 * /admin/crm — Lista de Empresas CRM
 * Inspiração: HubSpot Contacts · Pipedrive Companies
 */

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import type {
  CrmCompanyListItem,
  CrmCompaniesResponse,
  PipelineStage,
  CompanyStatus,
} from "@/types/crm";
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
  COMPANY_STATUS_LABELS,
} from "@/types/crm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 text-5xl">🏗️</div>
      <h3 className="font-display text-lg font-semibold text-paper">Nenhuma empresa CRM encontrada</h3>
      <p className="mt-2 text-sm text-mist">Cria a primeira empresa ou ajusta os filtros.</p>
      <button
        onClick={onNew}
        className="mt-6 rounded-lg bg-azul px-5 py-2.5 text-sm font-semibold text-white hover:bg-azul-dim transition"
      >
        + Nova Empresa
      </button>
    </div>
  );
}

// ── Modal de criação rápida ───────────────────────────────────────────────────

function NewCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName]   = useState("");
  const [nif, setNif]     = useState("");
  const [email, setEmail] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState<PipelineStage>("NEW_LEAD");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("O nome é obrigatório."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), nif: nif.trim() || undefined, email: email.trim() || undefined, sector: sector.trim() || undefined, pipelineStage: stage }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao criar empresa."); return; }
      onCreated(data.company.id);
    } catch {
      setError("Erro de rede. Tenta novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink2 p-6 shadow-2xl">
        <h2 className="font-display text-lg font-bold text-paper">Nova Empresa CRM</h2>
        <p className="mt-1 text-sm text-mist">Preenche os dados básicos para criar a empresa no funil.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-mist">Nome da Empresa *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Empresa ABC, Lda"
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2.5 text-sm text-paper placeholder:text-mist/50"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mist">NIF (10 dígitos)</label>
              <input
                value={nif}
                onChange={(e) => setNif(e.target.value)}
                placeholder="5002174308"
                className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2.5 text-sm text-paper placeholder:text-mist/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mist">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="geral@empresa.ao"
                className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2.5 text-sm text-paper placeholder:text-mist/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mist">Sector</label>
              <input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ex: Tecnologia"
                className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2.5 text-sm text-paper placeholder:text-mist/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mist">Stage Inicial</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as PipelineStage)}
                className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2.5 text-sm text-paper"
              >
                {(["NEW_LEAD","CONTACTED","QUALIFIED","PROPOSAL_SENT","NEGOTIATION"] as PipelineStage[]).map(s => (
                  <option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-azul px-5 py-2 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-50 transition">
              {saving ? "A criar…" : "Criar Empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const STAGES: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "Todos os stages" },
  ...Object.entries(PIPELINE_STAGE_LABELS).map(([value, label]) => ({ value, label })),
];

const STATUSES: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "Todos os estados" },
  ...Object.entries(COMPANY_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

export default function CrmListPage() {
  const [data, setData]         = useState<CrmCompaniesResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState("");
  const [stage, setStage]       = useState("ALL");
  const [status, setStatus]     = useState("ALL");
  const [page, setPage]         = useState(1);
  const [showNew, setShowNew]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (q) params.set("q", q);
    if (stage !== "ALL") params.set("pipelineStage", stage);
    if (status !== "ALL") params.set("crmStatus", status);
    try {
      const res = await fetch(`/api/crm/companies?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [q, stage, status, page]);

  // Debounce pesquisa
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); fetchCompanies(); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  useEffect(() => { setPage(1); fetchCompanies(); }, [stage, status]);
  useEffect(() => { fetchCompanies(); }, [page]);

  function handleCreated(id: string) {
    setShowNew(false);
    window.location.href = `/admin/crm/${id}`;
  }

  const companies = data?.data ?? [];
  const meta      = data?.meta;

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper">Empresas CRM</h1>
          <p className="mt-1 text-sm text-mist">
            {meta ? `${meta.total} empresa${meta.total !== 1 ? "s" : ""} no funil comercial` : "A carregar…"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/crm/kanban"
            className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5 hover:text-paper transition"
          >
            📌 Kanban
          </Link>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-dim transition"
          >
            + Nova Empresa
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar por nome, NIF ou e-mail…"
          className="focus-ring min-w-[220px] flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper placeholder:text-mist/50"
        />
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
        >
          {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
        >
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-mist">
            <tr>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">NIF</th>
              <th className="px-4 py-3 font-medium">Sector</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Criado em</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-azul border-t-transparent" />
                </td>
              </tr>
            )}
            {!loading && companies.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState onNew={() => setShowNew(true)} />
                </td>
              </tr>
            )}
            {!loading && companies.map((co) => (
              <tr key={co.id} className="group text-paper hover:bg-white/[0.02] transition">
                <td className="px-4 py-3">
                  <Link href={`/admin/crm/${co.id}`} className="font-medium hover:text-azul-glow transition">
                    {co.name}
                  </Link>
                  {co.email && <p className="text-xs text-mist mt-0.5">{co.email}</p>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-mist">{co.nif ?? "—"}</td>
                <td className="px-4 py-3 text-mist">{co.sector ?? "—"}</td>
                <td className="px-4 py-3">
                  {co.pipelineStage ? (
                    <Badge
                      label={PIPELINE_STAGE_LABELS[co.pipelineStage as PipelineStage]}
                      className={PIPELINE_STAGE_COLORS[co.pipelineStage as PipelineStage]}
                    />
                  ) : <span className="text-mist">—</span>}
                </td>
                <td className="px-4 py-3">
                  {co.crmStatus ? (
                    <span className="text-xs text-mist">
                      {COMPANY_STATUS_LABELS[co.crmStatus as CompanyStatus]}
                    </span>
                  ) : <span className="text-mist">—</span>}
                </td>
                <td className="px-4 py-3 text-mist text-xs">
                  {new Date(co.createdAt).toLocaleDateString("pt-AO")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/crm/${co.id}`}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-mist hover:bg-white/5 hover:text-paper transition opacity-0 group-hover:opacity-100"
                  >
                    Ver 360°
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {meta && meta.pages > 1 && (
        <div className="mt-5 flex items-center justify-between text-sm text-mist">
          <span>{meta.total} resultados · Página {meta.page} de {meta.pages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/5 transition"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
              disabled={page >= meta.pages}
              className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/5 transition"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}

      {showNew && <NewCompanyModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}
    </AdminLayout>
  );
}
