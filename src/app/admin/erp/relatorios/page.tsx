"use client";

/**
 * /admin/erp/relatorios — Relatórios Fiscais ERP (VOL02)
 *
 * Gera e exporta:
 *  - Mapa de IVA mensal (R-07)
 *  - Reconciliação bancária (R-05)
 *  - Export XLSX de faturas / pagamentos / despesas
 *
 * Consome /api/erp/reports/vat + /api/erp/reports/reconciliation + /api/erp/reports/export
 * VOL12 — Sprint VOL12-4
 */

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

function fmtKz(n: number): string {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(n);
}

// ── Mapa IVA ─────────────────────────────────────────────────────────────────

type VatEntry = {
  invoiceId:     string;
  invoiceNumber: string;
  companyName:   string;
  issueDate:     string;
  subtotal:      number;
  taxAmount:     number;
  total:         number;
  status:        string;
};

type VatReport = {
  period:      string;
  totalBase:   number;
  totalTax:    number;
  totalGross:  number;
  entries:     VatEntry[];
};

function VatTab() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<VatReport | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/reports/vat?year=${year}&month=${month}`);
      if (!res.ok) throw new Error();
      setReport(await res.json() as VatReport);
    } catch { alert("Erro ao gerar mapa IVA"); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m,i) => (
            <option key={i+1} value={i+1}>{m}</option>
          ))}
        </select>
        <button onClick={fetchReport} disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50">
          {loading ? "A gerar…" : "Gerar Mapa IVA"}
        </button>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Base Tributável</p>
              <p className="text-lg font-bold font-mono text-white">{fmtKz(report.totalBase)}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">IVA 14% a Entregar</p>
              <p className="text-lg font-bold font-mono text-yellow-400">{fmtKz(report.totalTax)}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Total Faturado</p>
              <p className="text-lg font-bold font-mono text-emerald-400">{fmtKz(report.totalGross)}</p>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Nº Fatura</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-right">Base</th>
                  <th className="px-4 py-3 text-right">IVA 14%</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {report.entries.map(e => (
                  <tr key={e.invoiceId} className="hover:bg-gray-800/50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-white">{e.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-300">{e.companyName}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(e.issueDate).toLocaleDateString("pt-PT", { day:"2-digit", month:"2-digit", year:"numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{fmtKz(e.subtotal)}</td>
                    <td className="px-4 py-3 text-right font-mono text-yellow-400">{fmtKz(e.taxAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-white">{fmtKz(e.total)}</td>
                    <td className="px-4 py-3 text-center text-slate-400 text-xs">{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Reconciliação ─────────────────────────────────────────────────────────────

function ReconciliacaoTab() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/reports/reconciliation?year=${year}&month=${month}`);
      if (!res.ok) throw new Error();
      setResult(await res.json() as Record<string, unknown>);
    } catch { alert("Erro ao gerar reconciliação"); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m,i) => (
            <option key={i+1} value={i+1}>{m}</option>
          ))}
        </select>
        <button onClick={fetchReport} disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50">
          {loading ? "A gerar…" : "Gerar Reconciliação"}
        </button>
      </div>

      {result && (
        <div className="bg-gray-900 rounded-xl p-6">
          <pre className="text-xs text-slate-300 overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

function ExportTab() {
  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [entity, setEntity]   = useState("invoices");
  const [loading, setLoading] = useState(false);

  async function doExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/reports/export?entity=${entity}&year=${year}&month=${month}`);
      if (!res.ok) { alert("Erro ao exportar"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${entity}-${year}-${String(month).padStart(2,"0")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Erro de rede"); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <p className="text-slate-400 text-sm mb-6">
        Exporta dados para XLSX. O ficheiro é gerado em tempo real a partir da base de dados.
      </p>
      <div className="flex flex-wrap gap-3">
        <select value={entity} onChange={e => setEntity(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="invoices">Faturas</option>
          <option value="payments">Pagamentos</option>
          <option value="expenses">Despesas</option>
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m,i) => (
            <option key={i+1} value={i+1}>{m}</option>
          ))}
        </select>
        <button onClick={doExport} disabled={loading}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition disabled:opacity-50">
          {loading ? "A exportar…" : "⬇ Exportar XLSX"}
        </button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type ReportTab = "iva" | "reconciliacao" | "export";

function RelatoriosPageInner() {
  const [tab, setTab] = useState<ReportTab>("iva");

  const tabs: Array<{ key: ReportTab; label: string }> = [
    { key: "iva",          label: "📊 Mapa IVA" },
    { key: "reconciliacao", label: "🔄 Reconciliação" },
    { key: "export",       label: "⬇ Export XLSX" },
  ];

  return (
    <div className="bg-gray-950 text-slate-200 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">📑 Relatórios Fiscais</h1>
        <p className="text-slate-400 text-sm mt-1">Mapa IVA, Reconciliação e Export de dados contabilísticos.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-800 pb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "px-4 py-2 rounded-lg text-sm font-medium transition",
              tab === t.key ? "bg-blue-600 text-white" : "bg-gray-800 text-slate-400 hover:bg-gray-700",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "iva"          && <VatTab />}
      {tab === "reconciliacao" && <ReconciliacaoTab />}
      {tab === "export"       && <ExportTab />}
    </div>
  );
}

// Navegação consistente: sidebar persistente à esquerda, conteúdo à direita
export default function RelatoriosPage() {
  return (
    <AdminLayout>
      <RelatoriosPageInner />
    </AdminLayout>
  );
}
