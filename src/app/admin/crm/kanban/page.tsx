"use client";

/**
 * /admin/crm/kanban — Pipeline Kanban
 * Inspiração: Pipedrive Pipeline · HubSpot Deals Board
 */

import { useEffect, useState, useCallback, useRef } from "react";
import Link                                          from "next/link";
import AdminLayout                                   from "@/components/admin/AdminLayout";
import type { KanbanResponse, KanbanCard, KanbanColumn, PipelineStage } from "@/types/crm";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_COLORS, ACTIVITY_TYPE_ICONS, formatKzCRM } from "@/types/crm";

// ── Colunas activas do Kanban (excluímos WON e LOST) ─────────────────────────

const ACTIVE_STAGES: PipelineStage[] = [
  "NEW_LEAD", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION",
];

// ── Card de empresa ───────────────────────────────────────────────────────────

function CompanyCard({ card }: { card: KanbanCard }) {
  const overdueTask = card.taskCount > 0;
  const hasDeals    = card.activeDeals.length > 0;

  return (
    <Link
      href={`/admin/crm/${card.id}`}
      className="block rounded-xl border border-white/10 bg-ink p-3.5 hover:border-azul/30 hover:bg-ink2 transition cursor-pointer group"
    >
      {/* Nome */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-paper group-hover:text-azul-glow transition line-clamp-2">
          {card.name}
        </p>
        {card.taskCount > 0 && (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            {card.taskCount} task{card.taskCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Sector */}
      {card.sector && <p className="mt-1 text-xs text-mist">{card.sector}</p>}

      {/* Contacto primário */}
      {card.primaryContact && (
        <p className="mt-1.5 text-xs text-mist truncate">
          👤 {card.primaryContact.firstName} {card.primaryContact.lastName}
          {card.primaryContact.email && ` · ${card.primaryContact.email}`}
        </p>
      )}

      {/* Deals activos */}
      {hasDeals && (
        <div className="mt-2 space-y-1">
          {card.activeDeals.slice(0, 2).map(d => (
            <div key={d.id} className="flex items-center justify-between text-xs">
              <span className="text-mist truncate max-w-[120px]">{d.title}</span>
              {d.value && <span className="text-azul-glow font-medium">{formatKzCRM(d.value)}</span>}
            </div>
          ))}
          {card.activeDeals.length > 2 && (
            <p className="text-[10px] text-mist">+{card.activeDeals.length - 2} deal(s)</p>
          )}
        </div>
      )}

      {/* Última actividade */}
      {card.lastActivity && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-mist/70">
          <span>{ACTIVITY_TYPE_ICONS[card.lastActivity.type as keyof typeof ACTIVITY_TYPE_ICONS] ?? "📌"}</span>
          <span className="truncate">{card.lastActivity.summary}</span>
        </div>
      )}

      {/* Valor total */}
      {card.dealValue > 0 && (
        <div className="mt-3 border-t border-white/5 pt-2">
          <p className="text-[10px] text-mist">Valor em pipeline</p>
          <p className="text-xs font-semibold text-emerald-400">{formatKzCRM(card.dealValue)}</p>
        </div>
      )}
    </Link>
  );
}

// ── Coluna do Kanban ──────────────────────────────────────────────────────────

function KanbanCol({ column }: { column: KanbanColumn }) {
  const stage = column.stage as PipelineStage;

  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Header da coluna */}
      <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${stageAccentColor(stage)}`} />
            <span className="text-sm font-semibold text-paper">{PIPELINE_STAGE_LABELS[stage]}</span>
          </div>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-mist">{column.count}</span>
        </div>
        {column.totalValue > 0 && (
          <p className="mt-1 text-xs text-mist">{formatKzCRM(column.totalValue)}</p>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
        {column.companies.length === 0 && (
          <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-mist">
            Nenhuma empresa
          </div>
        )}
        {column.companies.map(card => (
          <CompanyCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function stageAccentColor(stage: PipelineStage): string {
  const map: Record<PipelineStage, string> = {
    NEW_LEAD:      "bg-slate-400",
    CONTACTED:     "bg-blue-400",
    QUALIFIED:     "bg-violet-400",
    PROPOSAL_SENT: "bg-amber-400",
    NEGOTIATION:   "bg-orange-400",
    WON:           "bg-emerald-400",
    LOST:          "bg-red-400",
  };
  return map[stage] ?? "bg-mist";
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function KanbanPage() {
  const [data, setData]       = useState<KanbanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchKanban = useCallback(async (q = "") => {
    setLoading(true);
    const params = new URLSearchParams({ stages: ACTIVE_STAGES.join(",") });
    if (q) params.set("search", q);
    try {
      const res = await fetch(`/api/crm/pipeline?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKanban(); }, [fetchKanban]);

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchKanban(value), 350);
  }

  const meta = data?.meta;
  const totalValue = data?.columns.reduce((s, c) => s + c.totalValue, 0) ?? 0;

  return (
    <AdminLayout className="!p-0">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-white/10 bg-ink px-8 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-paper">Pipeline Comercial</h1>
              <p className="mt-1 text-sm text-mist">
                {meta
                  ? `${meta.totalCompanies} empresa${meta.totalCompanies !== 1 ? "s" : ""} activas · ${formatKzCRM(totalValue)} em pipeline`
                  : "A carregar…"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Filtrar empresas…"
                className="focus-ring w-56 rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper placeholder:text-mist/50"
              />
              <Link
                href="/admin/crm"
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5 hover:text-paper transition"
              >
                ≡ Lista
              </Link>
              <Link
                href="/admin/crm?create=1"
                onClick={e => { e.preventDefault(); window.location.href = "/admin/crm"; }}
                className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-dim transition"
              >
                + Nova Empresa
              </Link>
            </div>
          </div>

          {/* KPIs resumo */}
          {meta && (
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-mist">Ganhos: </span>
                <span className="font-semibold text-emerald-400">{meta.wonCount}</span>
              </div>
              <div>
                <span className="text-mist">Perdidos: </span>
                <span className="font-semibold text-red-400">{meta.lostCount}</span>
              </div>
              <div>
                <span className="text-mist">Âmbito: </span>
                <span className="font-semibold text-paper">{meta.scope === "global" ? "Global" : "Pessoal"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Board */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-azul border-t-transparent" />
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto p-6">
            <div className="flex h-full gap-4 pb-4">
              {ACTIVE_STAGES.map(stageName => {
                const col = data?.columns.find(c => c.stage === stageName) ?? {
                  stage: stageName, count: 0, totalValue: 0, companies: [],
                };
                return <KanbanCol key={stageName} column={col as KanbanColumn} />;
              })}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
