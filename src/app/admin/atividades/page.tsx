"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

interface CompanyActivity {
  id:             string;
  name:           string;
  plan:           string | null;
  contractStatus: string;
  salaMinutes:    number;
  salaLimit:      number;
  prints:         number;
  printLimit:     number;
}

type ModalType = "sala" | "prints" | null;

function pct(used: number, limit: number) {
  return Math.min(100, Math.round((used / limit) * 100));
}
function barColor(p: number) {
  if (p >= 100) return "bg-red-500";
  if (p >= 80)  return "bg-amber-400";
  return "bg-emerald-500";
}
function textColor(p: number) {
  if (p >= 100) return "text-red-400";
  if (p >= 80)  return "text-amber-300";
  return "text-emerald-400";
}
function fmtMins(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}min`;
  return min === 0 ? `${h}h` : `${h}h ${min}min`;
}
function nowMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AtividadesPage() {
  const [month, setMonth]           = useState(nowMonth());
  const [data, setData]             = useState<CompanyActivity[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState<ModalType>(null);
  const [selCompany, setSelCompany] = useState<CompanyActivity | null>(null);
  const [hours, setHours]           = useState("0");
  const [minutes, setMinutes]       = useState("0");
  const [printCount, setPrintCount] = useState("");
  const [notes, setNotes]           = useState("");
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/atividades?month=${month}`);
      if (res.ok) setData((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  function openSala(c: CompanyActivity) {
    setSelCompany(c); setHours("0"); setMinutes("30"); setNotes(""); setModal("sala");
  }
  function openPrints(c: CompanyActivity) {
    setSelCompany(c); setPrintCount(""); setNotes(""); setModal("prints");
  }
  function closeModal() {
    setModal(null); setSelCompany(null);
  }

  async function handleSave() {
    if (!selCompany) return;
    setSaving(true);
    const isSala = modal === "sala";
    const amount = isSala
      ? (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0)
      : parseInt(printCount) || 0;

    if (amount < 1) { setSaving(false); return; }

    await fetch("/api/atividades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: selCompany.id,
        type:      isSala ? "SESSAO_SALA" : "IMPRESSAO",
        amount,
        notes,
      }),
    });
    setSaving(false);
    closeModal();
    await load();
  }

  const alerts = data.filter(c =>
    pct(c.salaMinutes, c.salaLimit) >= 80 || pct(c.prints, c.printLimit) >= 80
  );

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-paper">Atividades & Benefícios</h1>
            <p className="text-sm text-mist mt-1">
              Utilização mensal por empresa — 2h sala de reunião + 30 impressões incluídas no plano.
              Zera automaticamente no início de cada mês.
            </p>
          </div>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
          />
        </div>

        {/* Alertas */}
        {alerts.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm font-semibold text-amber-300 mb-2">
              ⚠️ {alerts.length} empresa(s) com utilização elevada
            </p>
            <div className="flex flex-wrap gap-2">
              {alerts.map(c => (
                <span key={c.id} className="rounded-full bg-amber-500/15 px-3 py-0.5 text-xs text-amber-300">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Legenda */}
        <div className="flex items-center gap-6 text-xs text-mist">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full bg-emerald-500" /> Normal (&lt;80%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full bg-amber-400" /> Atenção (80–99%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full bg-red-500" /> Limite atingido (≥100%)
          </span>
        </div>

        {/* Tabela */}
        {loading ? (
          <p className="text-sm text-mist py-10 text-center">A carregar…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-mist py-10 text-center">Sem empresas registadas.</p>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-mist uppercase tracking-wider text-left">
                  <th className="px-5 py-3">Empresa</th>
                  <th className="px-5 py-3">Plano</th>
                  <th className="px-5 py-3">Sala de Reunião (2h/mês)</th>
                  <th className="px-5 py-3">Impressões (30/mês)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map(c => {
                  const salaPct  = pct(c.salaMinutes, c.salaLimit);
                  const printPct = pct(c.prints, c.printLimit);
                  return (
                    <tr key={c.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-paper">{c.name}</div>
                        <div className="text-xs text-mist/60 mt-0.5">{c.contractStatus}</div>
                      </td>
                      <td className="px-5 py-4 text-mist text-xs">{c.plan || "—"}</td>

                      {/* Sala */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-medium ${textColor(salaPct)}`}>
                            {fmtMins(c.salaMinutes)} / {fmtMins(c.salaLimit)}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs ${textColor(salaPct)}`}>{salaPct}%</span>
                            <button
                              onClick={() => openSala(c)}
                              className="text-xs text-azul hover:underline whitespace-nowrap"
                            >
                              + Sessão
                            </button>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/10">
                          <div
                            className={`h-1.5 rounded-full transition-all ${barColor(salaPct)}`}
                            style={{ width: `${salaPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Impressões */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-medium ${textColor(printPct)}`}>
                            {c.prints} / {c.printLimit}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs ${textColor(printPct)}`}>{printPct}%</span>
                            <button
                              onClick={() => openPrints(c)}
                              className="text-xs text-azul hover:underline whitespace-nowrap"
                            >
                              + Impressões
                            </button>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/10">
                          <div
                            className={`h-1.5 rounded-full transition-all ${barColor(printPct)}`}
                            style={{ width: `${printPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal — Sessão de Sala */}
        {modal === "sala" && selCompany && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0d1829] p-6 space-y-4">
              <div>
                <h2 className="font-semibold text-paper">Registar sessão de sala</h2>
                <p className="text-xs text-mist mt-1">
                  {selCompany.name} — {fmtMins(selCompany.salaMinutes)}/{fmtMins(selCompany.salaLimit)} usadas este mês
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-mist mb-1">Horas</label>
                  <input
                    type="number" min={0} max={8}
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                    className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
                  />
                </div>
                <div>
                  <label className="block text-xs text-mist mb-1">Minutos</label>
                  <select
                    value={minutes}
                    onChange={e => setMinutes(e.target.value)}
                    className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
                  >
                    {[0,15,30,45].map(m => (
                      <option key={m} value={m}>{m}min</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-mist mb-1">Notas (opcional)</label>
                <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
                  placeholder="Ex: Reunião com cliente"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={closeModal}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:text-paper hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || ((parseInt(hours)||0)*60+(parseInt(minutes)||0)) < 1}
                  className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-medium text-white hover:bg-azul-dim disabled:opacity-50"
                >
                  {saving ? "A guardar…" : "Registar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal — Impressões */}
        {modal === "prints" && selCompany && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0d1829] p-6 space-y-4">
              <div>
                <h2 className="font-semibold text-paper">Registar impressões</h2>
                <p className="text-xs text-mist mt-1">
                  {selCompany.name} — {selCompany.prints}/{selCompany.printLimit} usadas este mês
                </p>
              </div>
              <div>
                <label className="block text-xs text-mist mb-1">Nº de impressões *</label>
                <input
                  type="number" min={1}
                  value={printCount}
                  onChange={e => setPrintCount(e.target.value)}
                  className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
                  placeholder="Ex: 5"
                />
              </div>
              <div>
                <label className="block text-xs text-mist mb-1">Notas (opcional)</label>
                <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
                  placeholder="Ex: Relatório mensal"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={closeModal}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:text-paper hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !printCount || parseInt(printCount) < 1}
                  className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-medium text-white hover:bg-azul-dim disabled:opacity-50"
                >
                  {saving ? "A guardar…" : "Registar"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
