"use client";

/**
 * /admin/crm/dashboard — Dashboard CRM
 * Inspiração: HubSpot Reports · Salesforce Home
 */

import { useEffect, useState } from "react";
import Link                    from "next/link";
import AdminLayout             from "@/components/admin/AdminLayout";
import type { CrmDashboard }   from "@/types/crm";
import { PIPELINE_STAGE_LABELS, ACTIVITY_TYPE_ICONS, formatKzCRM } from "@/types/crm";

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, hint, accent = false, warn = false,
}: {
  label: string; value: string | number; hint?: string; accent?: boolean; warn?: boolean;
}) {
  return (
    <div className={[
      "rounded-2xl border p-5",
      accent ? "border-azul/30 bg-azul/10"
             : warn   ? "border-red-500/20 bg-red-500/5"
             : "border-white/10 bg-white/[0.03]",
    ].join(" ")}>
      <p className="text-xs font-medium text-mist">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${accent ? "text-azul-glow" : warn ? "text-red-400" : "text-paper"}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-mist">{hint}</p>}
    </div>
  );
}

// ── Funil visual ──────────────────────────────────────────────────────────────

const FUNNEL_STAGES = [
  "NEW_LEAD", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION",
] as const;

function FunnelChart({ byStage, total }: { byStage: Record<string, number>; total: number }) {
  const maxCount = Math.max(...FUNNEL_STAGES.map(s => byStage[s] ?? 0), 1);

  return (
    <div className="space-y-2">
      {FUNNEL_STAGES.map(stage => {
        const count = byStage[stage] ?? 0;
        const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
        const bar   = maxCount > 0 ? (count / maxCount) * 100 : 0;
        return (
          <div key={stage}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-mist">{PIPELINE_STAGE_LABELS[stage]}</span>
              <span className="font-medium text-paper">{count} <span className="text-mist font-normal">({pct}%)</span></span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-azul transition-all"
                style={{ width: `${bar}%` }}
              />
            </div>
          </div>
        );
      })}
      {byStage["WON"] !== undefined && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs">
          <span className="text-emerald-300">✓ Ganhos</span>
          <span className="font-semibold text-emerald-300">{byStage["WON"] ?? 0}</span>
        </div>
      )}
      {byStage["LOST"] !== undefined && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs">
          <span className="text-red-400">✕ Perdidos</span>
          <span className="font-semibold text-red-400">{byStage["LOST"] ?? 0}</span>
        </div>
      )}
    </div>
  );
}

// ── Pipeline por stage (deals) ────────────────────────────────────────────────

const DEAL_STAGES = ["DISCOVERY", "QUALIFICATION", "PROPOSAL", "NEGOTIATION"] as const;

const DEAL_STAGE_LABELS_SHORT: Record<string, string> = {
  DISCOVERY:     "Descoberta",
  QUALIFICATION: "Qualificação",
  PROPOSAL:      "Proposta",
  NEGOTIATION:   "Negociação",
};

function PipelineTable({ byStage }: { byStage: Record<string, { count: number; totalValue: number }> }) {
  return (
    <div className="divide-y divide-white/5">
      {DEAL_STAGES.map(stage => {
        const data = byStage[stage] ?? { count: 0, totalValue: 0 };
        return (
          <div key={stage} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-paper">{DEAL_STAGE_LABELS_SHORT[stage]}</p>
              <p className="text-xs text-mist">{data.count} deal{data.count !== 1 ? "s" : ""}</p>
            </div>
            <p className="text-sm font-semibold text-azul-glow">
              {data.totalValue > 0 ? formatKzCRM(data.totalValue) : "—"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Actividades recentes ──────────────────────────────────────────────────────

function RecentActivities({ activities }: { activities: CrmDashboard["recentActivities"] }) {
  if (activities.length === 0) {
    return <p className="py-4 text-sm text-mist text-center">Nenhuma actividade recente.</p>;
  }
  return (
    <div className="divide-y divide-white/5">
      {activities.map(a => (
        <div key={a.id} className="flex items-start gap-3 py-3">
          <span className="mt-0.5 text-base" aria-hidden>{ACTIVITY_TYPE_ICONS[a.type as keyof typeof ACTIVITY_TYPE_ICONS] ?? "📌"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-paper truncate">{a.summary}</p>
            <Link href={`/admin/crm/${a.company.id}`} className="text-xs text-azul-glow hover:underline">
              {a.company.name}
            </Link>
          </div>
          <p className="shrink-0 text-xs text-mist">
            {new Date(a.occurredAt).toLocaleDateString("pt-AO")}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CrmDashboardPage() {
  const [data, setData]       = useState<CrmDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    fetch("/api/crm/dashboard")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError("Erro ao carregar dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-azul border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <p className="text-sm text-red-400">{error || "Sem dados."}</p>
          <button onClick={() => window.location.reload()} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5">
            Tentar novamente
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper">Dashboard CRM</h1>
          <p className="mt-1 text-sm text-mist">
            {data.scope === "personal" ? "Vista pessoal" : "Vista global"} · Actualizado {new Date(data.generatedAt).toLocaleTimeString("pt-AO")}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/crm/kanban" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5 hover:text-paper transition">
            📌 Kanban
          </Link>
          <Link href="/admin/crm" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5 hover:text-paper transition">
            🏗️ Empresas
          </Link>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Empresas CRM" value={data.companies.total} hint="no funil activo" />
        <KpiCard label="Pipeline Value" value={formatKzCRM(data.pipeline.totalValue)} hint="deals activos" accent />
        <KpiCard label="Deals Ganhos" value={data.performance.wonTotal} hint={`${data.performance.won30d} nos últimos 30d`} />
        <KpiCard label="Taxa Conversão" value={data.performance.conversionRate !== null ? `${data.performance.conversionRate}%` : "—"} hint="WON / (WON + LOST)" />
        <KpiCard label="Tasks Vencidas" value={data.tasks.overdue} hint="requerem atenção" warn={data.tasks.overdue > 0} />
      </div>

      {/* Métricas secundárias */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Receita CRM (WON)" value={formatKzCRM(data.performance.wonValueAOA)} hint="total histórico" />
        <KpiCard label="Ciclo Médio" value={data.performance.avgCycleDays !== null ? `${data.performance.avgCycleDays}d` : "—"} hint="deal DISCOVERY → WON" />
        <KpiCard label="Tasks Pendentes" value={data.tasks.pending} hint="a iniciar" />
        <KpiCard label="Tasks em Curso" value={data.tasks.inProgress} hint="em progresso" />
      </div>

      {/* Segunda linha: Funil + Pipeline + Actividades */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Funil de empresas */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-4 text-sm font-semibold text-paper">Funil de Empresas</h3>
          <FunnelChart byStage={data.companies.byStage} total={data.companies.total} />
        </div>

        {/* Pipeline de deals por stage */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-paper">Pipeline de Deals</h3>
            <span className="text-xs text-mist">{formatKzCRM(data.pipeline.totalValue)} total</span>
          </div>
          <PipelineTable byStage={data.pipeline.byStage} />
        </div>

        {/* Actividades recentes */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-1 text-sm font-semibold text-paper">Actividades Recentes</h3>
          <p className="mb-4 text-xs text-mist">Últimas 7 interacções</p>
          <RecentActivities activities={data.recentActivities} />
        </div>
      </div>

      {/* Performance ganhos */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="mb-4 text-sm font-semibold text-paper">Performance de Vendas</h3>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            { label: "Deals ganhos (30d)", value: data.performance.won30d },
            { label: "Deals ganhos (90d)", value: data.performance.won90d },
            { label: "Total histórico WON", value: data.performance.wonTotal },
            { label: "Ciclo médio (dias)", value: data.performance.avgCycleDays ?? "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-mist">{label}</p>
              <p className="mt-1 text-2xl font-bold text-paper">{value}</p>
            </div>
          ))}
        </div>
        {data.performance.conversionRate !== null && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-mist">Taxa de Conversão</span>
              <span className="font-semibold text-paper">{data.performance.conversionRate}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${data.performance.conversionRate}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
