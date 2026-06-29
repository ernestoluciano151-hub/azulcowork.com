"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo",
  CONTACTADO: "Contactado",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  NOVO: "bg-blue-500/15 text-blue-300",
  CONTACTADO: "bg-amber-500/15 text-amber-300",
  CONFIRMADO: "bg-emerald-500/15 text-emerald-300",
  CANCELADO: "bg-red-500/15 text-red-300",
};
const PLANS = ["Alpha", "Beta", "Gamma", "Easy", "Personalizado"];

const EMPTY_FORM = {
  firstName: "", lastName: "", company: "", email: "",
  whatsapp: "", planName: "", participants: "",
  preferredDate: "", preferredTime: "", coffeeBreak: false, observations: "",
};

export default function LeadsSalasPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("ALL");
  const [planName, setPlanName] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Modal add manual
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");

  // Modal detail/observações
  const [detail, setDetail] = useState<any | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (planName !== "ALL") params.set("planName", planName);
    const res = await fetch(`/api/room-booking-leads?${params}`);
    if (res.ok) { const d = await res.json(); setLeads(d.leads); setTotal(d.total); }
    setLoading(false);
  }, [status, planName]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function updateStatus(id: string, newStatus: string) {
    await fetch(`/api/room-booking-leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchLeads();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setAddError("");
    const body = {
      firstName: form.firstName, lastName: form.lastName,
      company: form.company || undefined,
      email: form.email,
      whatsapp: `+244${form.whatsapp.replace(/\s/g, "")}`,
      planName: form.planName,
      participants: form.participants ? Number(form.participants) : undefined,
      preferredDate: form.preferredDate || undefined,
      preferredTime: form.preferredTime || undefined,
      coffeeBreak: form.coffeeBreak,
      observations: form.observations || undefined,
      source: "admin-manual",
    };
    const res = await fetch("/api/room-booking-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowAdd(false); setForm({ ...EMPTY_FORM }); fetchLeads();
    } else {
      const d = await res.json().catch(() => ({}));
      setAddError(d.error || "Erro ao guardar.");
    }
    setSaving(false);
  }

  const inp = "w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper focus:outline-none focus:ring-2 focus:ring-azul placeholder:text-mist/40";
  const lbl = "block text-xs font-medium text-mist mb-1";

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-paper">Leads — Salas</h1>
            <p className="mt-1 text-sm text-mist">{total} pedido(s) de reserva de sala.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-azul text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-azul-dim transition-colors"
          >
            + Adicionar lead
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-5">
          <select value={status} onChange={e => setStatus(e.target.value)} className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper">
            <option value="ALL">Todos os estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={planName} onChange={e => setPlanName(e.target.value)} className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper">
            <option value="ALL">Todos os planos</option>
            {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-mist">
              <tr>
                <th className="px-4 py-3 font-medium">Nome / Email</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Partic.</th>
                <th className="px-4 py-3 font-medium">Data Pref.</th>
                <th className="px-4 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium">Coffee</th>
                <th className="px-4 py-3 font-medium">Observações</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Registo</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-mist">A carregar...</td></tr>
              )}
              {!loading && leads.length === 0 && (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-mist">Nenhum pedido encontrado.</td></tr>
              )}
              {leads.map(l => (
                <tr key={l.id} className="text-paper hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-medium">{l.firstName} {l.lastName}</p>
                    <p className="text-xs text-mist">{l.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`https://wa.me/${l.whatsapp?.replace(/\D/g,"")}`} target="_blank" rel="noopener" className="text-azul hover:text-paper text-sm font-medium">
                      {l.whatsapp || "—"}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-mist">{l.company || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-azul/10 text-azul px-2 py-0.5 text-xs font-medium">{l.planName}</span>
                  </td>
                  <td className="px-4 py-3 text-mist text-center">{l.participants || "—"}</td>
                  <td className="px-4 py-3 text-mist">{l.preferredDate ? format(new Date(l.preferredDate), "dd/MM/yyyy") : "—"}</td>
                  <td className="px-4 py-3 text-mist">{l.preferredTime || "—"}</td>
                  <td className="px-4 py-3 text-center">{l.coffeeBreak ? "☕" : "—"}</td>
                  <td className="px-4 py-3 max-w-xs">
                    {l.observations ? (
                      <button
                        onClick={() => setDetail(l)}
                        className="text-xs text-mist hover:text-paper underline underline-offset-2 text-left line-clamp-2"
                        title={l.observations}
                      >
                        {l.observations.length > 60 ? l.observations.slice(0, 60) + "…" : l.observations}
                      </button>
                    ) : <span className="text-mist">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[l.status]}`}>
                      {STATUS_LABELS[l.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-mist text-xs whitespace-nowrap">{format(new Date(l.createdAt), "dd/MM/yy HH:mm")}</td>
                  <td className="px-4 py-3">
                    <select
                      value={l.status}
                      onChange={e => updateStatus(l.id, e.target.value)}
                      className="focus-ring rounded border border-white/10 bg-ink px-2 py-1 text-xs text-paper"
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal: Adicionar lead manualmente */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-ink2 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg font-bold text-paper">Adicionar lead — Sala</h2>
              <button onClick={() => { setShowAdd(false); setAddError(""); }} className="text-mist hover:text-paper text-xl">✕</button>
            </div>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Nome *</label>
                <input required className={inp} placeholder="Ex: Ernesto" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Apelido *</label>
                <input required className={inp} placeholder="Ex: Luciano" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>E-mail *</label>
                <input required type="email" className={inp} placeholder="nome@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>WhatsApp (nº sem código) *</label>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-mist bg-ink border border-white/10 rounded-lg px-3 py-2">🇦🇴 +244</span>
                  <input required className={inp} placeholder="9XX XXX XXX" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={lbl}>Empresa</label>
                <input className={inp} placeholder="Nome da empresa" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Plano *</label>
                <select required className={inp} value={form.planName} onChange={e => setForm(f => ({ ...f, planName: e.target.value }))}>
                  <option value="">Selecionar plano</option>
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Participantes</label>
                <input type="number" min={1} className={inp} placeholder="Ex: 8" value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Data preferida</label>
                <input type="date" className={inp} value={form.preferredDate} onChange={e => setForm(f => ({ ...f, preferredDate: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Hora preferida</label>
                <input type="time" className={inp} value={form.preferredTime} onChange={e => setForm(f => ({ ...f, preferredTime: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <input
                  type="checkbox"
                  id="coffeeBreak"
                  checked={form.coffeeBreak}
                  onChange={e => setForm(f => ({ ...f, coffeeBreak: e.target.checked }))}
                  className="w-4 h-4 accent-azul"
                />
                <label htmlFor="coffeeBreak" className="text-sm text-paper">☕ Incluir Coffee Break</label>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Observações</label>
                <textarea
                  rows={3}
                  className={inp + " resize-none"}
                  placeholder="Notas adicionais sobre o pedido..."
                  value={form.observations}
                  onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                />
              </div>
              {addError && <p className="sm:col-span-2 text-sm text-red-400">{addError}</p>}
              <div className="sm:col-span-2 flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowAdd(false); setAddError(""); }} className="px-5 py-2.5 rounded-xl border border-white/10 text-mist hover:text-paper text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-azul text-white font-semibold text-sm hover:bg-azul-dim disabled:opacity-60">
                  {saving ? "A guardar…" : "Guardar lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ver observações completas */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink2 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-paper">
                {detail.firstName} {detail.lastName}
              </h2>
              <button onClick={() => setDetail(null)} className="text-mist hover:text-paper text-xl">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2"><span className="text-mist w-28 shrink-0">WhatsApp:</span><a href={`https://wa.me/${detail.whatsapp?.replace(/\D/g,"")}`} target="_blank" rel="noopener" className="text-azul">{detail.whatsapp}</a></div>
              <div className="flex gap-2"><span className="text-mist w-28 shrink-0">E-mail:</span><span className="text-paper">{detail.email}</span></div>
              <div className="flex gap-2"><span className="text-mist w-28 shrink-0">Plano:</span><span className="text-paper">{detail.planName}</span></div>
              <div className="flex gap-2"><span className="text-mist w-28 shrink-0">Participantes:</span><span className="text-paper">{detail.participants || "—"}</span></div>
              <div className="flex gap-2"><span className="text-mist w-28 shrink-0">Data:</span><span className="text-paper">{detail.preferredDate ? format(new Date(detail.preferredDate), "dd/MM/yyyy") : "—"}</span></div>
              <div className="flex gap-2"><span className="text-mist w-28 shrink-0">Hora:</span><span className="text-paper">{detail.preferredTime || "—"}</span></div>
              <div className="flex gap-2"><span className="text-mist w-28 shrink-0">Coffee Break:</span><span className="text-paper">{detail.coffeeBreak ? "☕ Sim" : "Não"}</span></div>
              <div>
                <span className="text-mist block mb-1">Observações:</span>
                <p className="text-paper bg-ink rounded-lg p-3 text-sm whitespace-pre-wrap">{detail.observations || "Sem observações."}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
