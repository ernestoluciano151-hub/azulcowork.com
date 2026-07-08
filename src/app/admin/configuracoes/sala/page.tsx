"use client";

import { useState, useEffect } from "react";
import { formatKz } from "@/lib/currency";

type Settings = {
  id: string;
  defaultPricePerHour: number;
  defaultHalfDay: number;
  defaultFullDay: number;
  defaultWeekend: number;
  defaultIva: number;
  maxDiscount: number;
  currency: string;
  openTime: string;
  closeTime: string;
  minHours: number;
  maxHours: number;
};

const inp = "w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2.5 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none placeholder:text-[#4b5a77]";
const lbl = "block text-xs font-medium text-[#94A3B8] mb-1.5";

export default function SalaSettingsPage() {
  const [form, setForm] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/room-settings")
      .then(r => r.json())
      .then(d => { setForm(d.settings || {}); setLoading(false); });
  }, []);

  function set(key: keyof Settings, val: string | number) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/room-settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json(); setForm(d.settings);
      setToast({ type: "ok", msg: "Configurações guardadas com sucesso." });
    } else {
      setToast({ type: "err", msg: "Erro ao guardar configurações." });
    }
    setTimeout(() => setToast(null), 3500);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 border-2 border-[#2F6FED] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#F5F7FA]">Configurações — Sala de Reunião</h1>
        <p className="text-sm text-[#94A3B8] mt-1">Ajuste preços, IVA e regras de reserva sem editar código.</p>
      </div>

      {toast && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${toast.type === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {toast.msg}
        </div>
      )}

      {/* Preços Padrão */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1829] p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-[#F5F7FA]">💰 Preços Padrão</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Usados como base em todos os planos. Cada plano pode ter preços próprios configurados separadamente.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Preço por Hora (AOA)</label>
            <input type="number" min="0" value={form.defaultPricePerHour ?? ""} onChange={e => set("defaultPricePerHour", e.target.value)} className={inp} placeholder="15000" />
            {form.defaultPricePerHour ? <p className="text-xs text-[#5C8FFF] mt-1">{formatKz(Number(form.defaultPricePerHour))}/hora</p> : null}
          </div>
          <div>
            <label className={lbl}>Preço Meio Dia — 4h (AOA)</label>
            <input type="number" min="0" value={form.defaultHalfDay ?? ""} onChange={e => set("defaultHalfDay", e.target.value)} className={inp} placeholder="50000" />
          </div>
          <div>
            <label className={lbl}>Preço Dia Inteiro — 8h+ (AOA)</label>
            <input type="number" min="0" value={form.defaultFullDay ?? ""} onChange={e => set("defaultFullDay", e.target.value)} className={inp} placeholder="90000" />
          </div>
          <div>
            <label className={lbl}>Preço Fim de Semana (AOA)</label>
            <input type="number" min="0" value={form.defaultWeekend ?? ""} onChange={e => set("defaultWeekend", e.target.value)} className={inp} placeholder="120000" />
          </div>
        </div>

        <div className="rounded-xl border border-[#2F6FED]/20 bg-[#2F6FED]/5 p-3 text-xs text-[#94A3B8]">
          <p className="font-medium text-[#5C8FFF] mb-1">Como o sistema calcula o preço</p>
          <p>1. Se for fim de semana e houver preço fim de semana configurado → usa esse valor</p>
          <p>2. Se a duração ≥ 6h e houver preço dia inteiro → usa esse valor (mais barato)</p>
          <p>3. Se a duração ≥ 3h e o preço meio dia for inferior ao horário × hora → usa preço meio dia</p>
          <p>4. Caso contrário → duração × preço por hora</p>
        </div>
      </section>

      {/* Impostos */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1829] p-6 space-y-4">
        <h2 className="text-base font-bold text-[#F5F7FA]">🧾 Impostos e Descontos</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>IVA Padrão (%)</label>
            <select value={form.defaultIva ?? 0} onChange={e => set("defaultIva", e.target.value)} className={inp}>
              <option value="0">Isento (0%)</option>
              <option value="7">7%</option>
              <option value="14">14%</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Desconto Máximo Permitido (%)</label>
            <input type="number" min="0" max="100" value={form.maxDiscount ?? ""} onChange={e => set("maxDiscount", e.target.value)} className={inp} placeholder="100" />
          </div>
          <div>
            <label className={lbl}>Moeda</label>
            <select value={form.currency ?? "AOA"} onChange={e => set("currency", e.target.value)} className={inp}>
              <option value="AOA">AOA — Kwanza Angolano</option>
              <option value="USD">USD — Dólar Americano</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
        </div>
      </section>

      {/* Regras de Reserva */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1829] p-6 space-y-4">
        <h2 className="text-base font-bold text-[#F5F7FA]">⏰ Regras de Reserva</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Horário de Abertura</label>
            <input type="time" value={form.openTime ?? "08:00"} onChange={e => set("openTime", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Horário de Encerramento</label>
            <input type="time" value={form.closeTime ?? "18:00"} onChange={e => set("closeTime", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Tempo Mínimo de Reserva (horas)</label>
            <input type="number" min="0.5" step="0.5" value={form.minHours ?? ""} onChange={e => set("minHours", e.target.value)} className={inp} placeholder="1" />
          </div>
          <div>
            <label className={lbl}>Tempo Máximo de Reserva (horas)</label>
            <input type="number" min="1" step="0.5" value={form.maxHours ?? ""} onChange={e => set("maxHours", e.target.value)} className={inp} placeholder="12" />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="rounded-xl bg-[#2F6FED] px-8 py-2.5 text-sm font-semibold text-white hover:bg-[#1E4FB8] disabled:opacity-50">
          {saving ? "A guardar..." : "💾 Guardar Configurações"}
        </button>
      </div>
    </div>
  );
}
