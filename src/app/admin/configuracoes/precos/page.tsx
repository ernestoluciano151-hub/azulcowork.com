"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { formatKz } from "@/lib/currency";

type Tier = {
  id?:             string;
  label:           string;
  durationMinutes: number;
  price:           number;
  active:          boolean;
  sortOrder:       number;
  isNew?:          boolean;
  isDirty?:        boolean;
};

const inp  = "w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none placeholder:text-[#4b5a77]";
const lbl  = "block text-xs font-medium text-[#94A3B8] mb-1";

function minutesToLabel(m: number): string {
  if (m < 60)  return `${m} min`;
  if (m === 60) return "1 hora";
  if (m % 60 === 0) return `${m / 60} horas`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h ${r}min`;
}

export default function PrecosPage() {
  const [tiers,   setTiers]   = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // New tier form
  const [newLabel,    setNewLabel]    = useState("");
  const [newMinutes,  setNewMinutes]  = useState("");
  const [newPrice,    setNewPrice]    = useState("");
  const [adding,      setAdding]      = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/room-pricing?roomId=sala-reuniao");
    const d = await r.json();
    setTiers((d.tiers || []).map((t: Tier) => ({ ...t, isDirty: false })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function markDirty(id: string | undefined, field: keyof Tier, val: string | number | boolean) {
    setTiers(prev => prev.map(t =>
      t.id === id ? { ...t, [field]: val, isDirty: true } : t
    ));
  }

  async function saveAll() {
    const dirty = tiers.filter(t => t.isDirty && !t.isNew && t.id);
    if (!dirty.length) { showToast("ok", "Nada para guardar."); return; }
    setSaving(true);
    try {
      await Promise.all(dirty.map(t =>
        fetch(`/api/admin/room-pricing/${t.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: t.label, durationMinutes: t.durationMinutes, price: t.price }),
        })
      ));
      await load();
      showToast("ok", `${dirty.length} ${dirty.length === 1 ? "linha actualizada" : "linhas actualizadas"}.`);
    } catch {
      showToast("err", "Erro ao guardar.");
    } finally { setSaving(false); }
  }

  async function addTier() {
    if (!newLabel || !newMinutes || !newPrice) {
      showToast("err", "Preencha todos os campos."); return;
    }
    setAdding(true);
    const res = await fetch("/api/admin/room-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label:           newLabel,
        durationMinutes: Number(newMinutes),
        price:           Number(newPrice),
        sortOrder:       tiers.length,
      }),
    });
    setAdding(false);
    if (res.ok) {
      setNewLabel(""); setNewMinutes(""); setNewPrice("");
      await load();
      showToast("ok", "Nível de preço adicionado.");
    } else {
      showToast("err", "Erro ao adicionar.");
    }
  }

  async function deleteTier(id: string) {
    if (!confirm("Remover este nível de preço?")) return;
    await fetch(`/api/admin/room-pricing/${id}`, { method: "DELETE" });
    await load();
    showToast("ok", "Nível removido.");
  }

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // Preview of what the pricing lookup would return for a given duration
  function findPriceForMinutes(minutes: number): Tier | undefined {
    const sorted = [...tiers].filter(t => t.active).sort((a, b) => a.durationMinutes - b.durationMinutes);
    // Exact match first
    const exact = sorted.find(t => t.durationMinutes === minutes);
    if (exact) return exact;
    // Closest ≤
    return sorted.filter(t => t.durationMinutes <= minutes).at(-1);
  }

  const previewMinutes = [60, 120, 180, 240, 300, 360, 420, 480];

  if (loading) return (
    <AdminLayout>
      <div className="flex flex-1 items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-[#2F6FED] border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#F5F7FA]">Preços da Sala de Reunião</h1>
              <p className="text-sm text-[#94A3B8] mt-1">
                Configure os preços por duração. O sistema aplica automaticamente o preço correcto ao criar uma reserva.
              </p>
            </div>
            {tiers.some(t => t.isDirty) && (
              <button onClick={saveAll} disabled={saving}
                className="rounded-xl bg-[#2F6FED] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1E4FB8] disabled:opacity-50">
                {saving ? "A guardar..." : "💾 Guardar alterações"}
              </button>
            )}
          </div>

          {toast && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${toast.type === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
              {toast.msg}
            </div>
          )}

          {/* How it works */}
          <div className="rounded-xl border border-[#2F6FED]/20 bg-[#2F6FED]/5 p-4">
            <p className="text-sm font-semibold text-[#5C8FFF] mb-2">⚡ Como funciona</p>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Quando o utilizador escolhe um horário na Nova Reserva, o sistema calcula a duração em minutos e procura
              o preço correspondente nesta tabela. Se não existir uma correspondência exacta, aplica o nível imediatamente
              inferior. O preço é preenchido automaticamente — sem necessidade de escrever valores.
            </p>
          </div>

          {/* Pricing table */}
          <section className="rounded-2xl border border-white/10 bg-[#0d1829] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-bold text-[#F5F7FA]">Tabela de Preços</h2>
              <span className="text-xs text-[#94A3B8]">{tiers.filter(t => t.active).length} níveis activos</span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-white/5 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Nome do Nível</div>
              <div className="col-span-3">Duração (minutos)</div>
              <div className="col-span-3">Preço (AOA)</div>
              <div className="col-span-1 text-right">Ação</div>
            </div>

            {tiers.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#94A3B8]">
                Nenhum nível configurado. Adicione o primeiro abaixo.
              </div>
            )}

            {tiers.map((tier, i) => (
              <div key={tier.id || i}
                className={`grid grid-cols-12 gap-3 items-center px-5 py-3 border-b border-white/5 transition-colors ${tier.isDirty ? "bg-[#2F6FED]/5" : ""}`}>
                <div className="col-span-1 text-xs text-[#94A3B8]">{i + 1}</div>

                <div className="col-span-4">
                  <input
                    value={tier.label}
                    onChange={e => markDirty(tier.id, "label", e.target.value)}
                    className={inp}
                    placeholder="Ex: Meio Período"
                  />
                </div>

                <div className="col-span-3">
                  <div className="relative">
                    <input
                      type="number" min="1"
                      value={tier.durationMinutes}
                      onChange={e => markDirty(tier.id, "durationMinutes", Number(e.target.value))}
                      className={inp}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] pointer-events-none">
                      = {minutesToLabel(tier.durationMinutes)}
                    </span>
                  </div>
                </div>

                <div className="col-span-3">
                  <div className="relative">
                    <input
                      type="number" min="0" step="500"
                      value={tier.price}
                      onChange={e => markDirty(tier.id, "price", Number(e.target.value))}
                      className={inp}
                    />
                    {tier.isDirty && (
                      <span className="absolute -top-1.5 right-1 text-[9px] text-[#2F6FED] font-bold bg-[#0d1829] px-1">editado</span>
                    )}
                  </div>
                  <p className="text-xs text-[#5C8FFF] mt-0.5">{formatKz(tier.price)}</p>
                </div>

                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => tier.id && deleteTier(tier.id)}
                    className="text-red-400/60 hover:text-red-400 text-base transition-colors"
                    title="Remover">
                    ×
                  </button>
                </div>
              </div>
            ))}

            {/* Add new row */}
            <div className="grid grid-cols-12 gap-3 items-end px-5 py-4 bg-white/[0.01]">
              <div className="col-span-1 text-xs text-[#94A3B8] pt-6">+</div>
              <div className="col-span-4">
                <label className={lbl}>Nome do Nível</label>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  placeholder="Ex: 3 Horas" className={inp} />
              </div>
              <div className="col-span-3">
                <label className={lbl}>Duração (minutos)</label>
                <input type="number" min="1" value={newMinutes} onChange={e => setNewMinutes(e.target.value)}
                  placeholder="Ex: 180" className={inp} />
                {newMinutes && Number(newMinutes) > 0 && (
                  <p className="text-xs text-[#94A3B8] mt-0.5">{minutesToLabel(Number(newMinutes))}</p>
                )}
              </div>
              <div className="col-span-3">
                <label className={lbl}>Preço (AOA)</label>
                <input type="number" min="0" step="500" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                  placeholder="Ex: 40000" className={inp} />
                {newPrice && Number(newPrice) > 0 && (
                  <p className="text-xs text-[#5C8FFF] mt-0.5">{formatKz(Number(newPrice))}</p>
                )}
              </div>
              <div className="col-span-1">
                <button onClick={addTier} disabled={adding || !newLabel || !newMinutes || !newPrice}
                  className="w-full rounded-lg bg-[#2F6FED] py-2 text-xs font-semibold text-white hover:bg-[#1E4FB8] disabled:opacity-40">
                  {adding ? "..." : "Adicionar"}
                </button>
              </div>
            </div>
          </section>

          {/* Auto-save hint */}
          {tiers.some(t => t.isDirty) && (
            <div className="flex items-center justify-between rounded-xl border border-[#2F6FED]/25 bg-[#2F6FED]/5 px-4 py-3">
              <p className="text-sm text-[#5C8FFF]">
                ✎ Tens {tiers.filter(t => t.isDirty).length} {tiers.filter(t => t.isDirty).length === 1 ? "linha" : "linhas"} com alterações não guardadas.
              </p>
              <button onClick={saveAll} disabled={saving}
                className="rounded-lg bg-[#2F6FED] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E4FB8] disabled:opacity-50">
                {saving ? "A guardar..." : "💾 Guardar"}
              </button>
            </div>
          )}

          {/* Preview simulator */}
          <section className="rounded-2xl border border-white/10 bg-[#0d1829] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-bold text-[#F5F7FA]">Simulador de Preços</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">Prévia de como o sistema irá calcular o preço para cada duração.</p>
            </div>
            <div className="divide-y divide-white/5">
              {previewMinutes.map(m => {
                const match = findPriceForMinutes(m);
                return (
                  <div key={m} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-[#F5F7FA] font-medium w-20">{minutesToLabel(m)}</span>
                      {match ? (
                        <span className="rounded-full bg-[#2F6FED]/10 border border-[#2F6FED]/20 px-2 py-0.5 text-xs text-[#5C8FFF]">
                          {match.label}{match.durationMinutes !== m ? ` (${minutesToLabel(match.durationMinutes)})` : ""}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                          sem preço configurado
                        </span>
                      )}
                    </div>
                    <span className={match ? "font-bold text-[#5C8FFF]" : "text-[#94A3B8]"}>
                      {match ? formatKz(match.price) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Tips */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-2 text-xs text-[#94A3B8]">
            <p className="text-[#F5F7FA] font-medium text-sm mb-2">💡 Dicas</p>
            <p>• Cada nível representa uma duração exacta em minutos (ex: 240 = 4 horas).</p>
            <p>• Se a duração não tiver correspondência exacta, o sistema usa o nível imediatamente inferior.</p>
            <p>• Para preço por hora (sem pacotes), configura apenas "1 Hora" e o sistema multiplica automaticamente.</p>
            <p>• Podes ter vários níveis: 1h a 15.000, 2h a 28.000, 4h a 50.000, 8h a 90.000.</p>
            <p>• As alterações entram em vigor imediatamente após guardar.</p>
          </div>

      </div>
    </AdminLayout>
  );
}
