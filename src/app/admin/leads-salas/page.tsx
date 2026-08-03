"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import DeleteRequestModal from "@/components/admin/DeleteRequestModal";
import ReservationModal, { MeetingPlan } from "@/components/admin/ReservationModal";
import { format } from "date-fns";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo",
  CONTACTADO: "Contactado",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  RESERVA_CRIADA: "Reserva Criada",
  CONVERTIDO: "Convertido",
};
const STATUS_COLORS: Record<string, string> = {
  NOVO: "bg-blue-500/15 text-blue-300",
  CONTACTADO: "bg-amber-500/15 text-amber-300",
  CONFIRMADO: "bg-emerald-500/15 text-emerald-300",
  CANCELADO: "bg-red-500/15 text-red-300",
  RESERVA_CRIADA: "bg-indigo-500/15 text-indigo-300",
  CONVERTIDO: "bg-emerald-600/20 text-emerald-200",
};
const PLANS = ["Alpha", "Beta", "Gamma", "Easy", "Executiva", "Personalizado"];

const EMPTY_FORM = {
  firstName: "", lastName: "", company: "", email: "",
  whatsapp: "", planName: "", participants: "",
  preferredDate: "", preferredTime: "", coffeeBreak: false, observations: "",
};

const EMPTY_CONVERT = {
  roomNumber: "", planType: "", rentAmount: "", contractStart: "", contractEnd: "",
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
  const [deleteModal, setDeleteModal] = useState<{ id: string; label: string } | null>(null);

  // Convert modal
  const [convertLead, setConvertLead] = useState<any | null>(null);
  const [convertForm, setConvertForm] = useState({ ...EMPTY_CONVERT });
  const [convertSaving, setConvertSaving] = useState(false);
  const [convertError, setConvertError] = useState("");

  // To-reservation modal
  const [reservLead, setReservLead] = useState<any | null>(null);
  const [meetingPlans, setMeetingPlans] = useState<MeetingPlan[]>([]);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

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

  useEffect(() => {
    fetch("/api/plans")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.plans) setMeetingPlans(d.plans); })
      .catch(() => {});
  }, []);

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

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!convertLead) return;
    setConvertSaving(true); setConvertError("");
    const res = await fetch(`/api/room-booking-leads/${convertLead.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomNumber: convertForm.roomNumber || "A definir",
        planType: convertForm.planType || convertLead.planName,
        rentAmount: convertForm.rentAmount ? Number(convertForm.rentAmount) : 0,
        contractStart: convertForm.contractStart || undefined,
        contractEnd: convertForm.contractEnd || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setConvertSaving(false);
    if (res.ok) {
      showToast(`Lead convertido em empresa com sucesso!`, true);
      setConvertLead(null);
      setConvertForm({ ...EMPTY_CONVERT });
      fetchLeads();
    } else {
      setConvertError(data.error || "Erro ao converter.");
    }
  }

  const inp = "w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper focus:outline-none focus:ring-2 focus:ring-azul placeholder:text-mist/40";
  const lbl = "block text-xs font-medium text-mist mb-1";

  return (
    <AdminLayout>

        {/* Toast */}
        {toast && (
          <div className={`fixed right-6 top-6 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
            {toast.msg}
          </div>
        )}

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
                <th className="px-4 py-3 font-medium">Coffee</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Registo</th>
                <th className="px-4 py-3 font-medium">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-mist">A carregar...</td></tr>
              )}
              {!loading && leads.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-mist">Nenhum pedido encontrado.</td></tr>
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
                  <td className="px-4 py-3 text-center">{l.coffeeBreak ? "☕" : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[l.status] || "bg-white/10 text-mist"}`}>
                        {STATUS_LABELS[l.status] || l.status}
                      </span>
                      {l.companyId && (
                        <Link href={`/admin/financeiro/empresa/${l.companyId}`}
                          className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                          🏢 Ver empresa
                        </Link>
                      )}
                      {l.reservationId && !l.companyId && (
                        <span className="text-xs text-indigo-400">📅 Reserva criada</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-mist text-xs whitespace-nowrap">{format(new Date(l.createdAt), "dd/MM/yy HH:mm")}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={l.status}
                          onChange={e => updateStatus(l.id, e.target.value)}
                          className="focus-ring rounded border border-white/10 bg-ink px-2 py-1 text-xs text-paper"
                        >
                          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <button
                          onClick={() => setDeleteModal({ id: l.id, label: `${l.firstName} ${l.lastName}` })}
                          className="rounded-lg border border-red-500/20 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                          title="Pedir eliminação"
                        >
                          🗑️
                        </button>
                      </div>
                      {!l.reservationId && l.status !== "CONVERTIDO" && (
                        <button
                          onClick={() => setReservLead(l)}
                          className="rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-500/20 text-left"
                        >
                          📅 Criar Reserva
                        </button>
                      )}
                      {!l.companyId && (
                        <button
                          onClick={() => { setConvertLead(l); setConvertForm({ ...EMPTY_CONVERT, planType: l.planName }); }}
                          className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 text-left"
                        >
                          🏢 Converter em Cliente
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
                <input type="checkbox" id="coffeeBreak" checked={form.coffeeBreak} onChange={e => setForm(f => ({ ...f, coffeeBreak: e.target.checked }))} className="w-4 h-4 accent-azul" />
                <label htmlFor="coffeeBreak" className="text-sm text-paper">☕ Incluir Coffee Break</label>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Observações</label>
                <textarea rows={3} className={inp + " resize-none"} placeholder="Notas adicionais..." value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} />
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

      {/* Modal: Converter em Cliente */}
      {convertLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink2 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-paper">🏢 Converter em Cliente</h2>
              <button onClick={() => { setConvertLead(null); setConvertError(""); }} className="text-mist hover:text-paper text-xl">✕</button>
            </div>
            <p className="text-sm text-mist mb-5">
              Lead: <span className="text-paper font-medium">{convertLead.firstName} {convertLead.lastName}</span> · {convertLead.email}
            </p>
            <form onSubmit={handleConvert} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Nº Sala</label>
                  <input className={inp} placeholder="Ex: 101" value={convertForm.roomNumber} onChange={e => setConvertForm(f => ({ ...f, roomNumber: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Tipo de Plano</label>
                  <input className={inp} placeholder="Ex: Coworking" value={convertForm.planType} onChange={e => setConvertForm(f => ({ ...f, planType: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={lbl}>Renda Mensal (AOA)</label>
                <input type="number" min={0} className={inp} placeholder="Ex: 150000" value={convertForm.rentAmount} onChange={e => setConvertForm(f => ({ ...f, rentAmount: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Início de Contrato</label>
                  <input type="date" className={inp} value={convertForm.contractStart} onChange={e => setConvertForm(f => ({ ...f, contractStart: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Fim de Contrato</label>
                  <input type="date" className={inp} value={convertForm.contractEnd} onChange={e => setConvertForm(f => ({ ...f, contractEnd: e.target.value }))} />
                </div>
              </div>
              {convertError && <p className="text-sm text-red-400">{convertError}</p>}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setConvertLead(null); setConvertError(""); }} className="px-5 py-2.5 rounded-xl border border-white/10 text-mist hover:text-paper text-sm">Cancelar</button>
                <button type="submit" disabled={convertSaving} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-60">
                  {convertSaving ? "A converter…" : "Converter em Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Criar Reserva — smart modal com cálculo automático de preços */}
      {reservLead && (
        <ReservationModal
          plans={meetingPlans}
          selectedLeadId={reservLead.id}
          initialData={{
            responsibleName: `${reservLead.firstName} ${reservLead.lastName}`,
            responsibleEmail: reservLead.email,
            responsibleWhatsapp: reservLead.whatsapp || "",
            companyName: reservLead.company || "",
            participants: reservLead.participants || 1,
            coffeeBreak: reservLead.coffeeBreak || false,
            observations: reservLead.observations || "",
            planName: reservLead.planName || "",
            preferredDate: reservLead.preferredDate
              ? new Date(reservLead.preferredDate).toISOString().slice(0, 10)
              : "",
            preferredTime: reservLead.preferredTime || "",
          }}
          onClose={() => setReservLead(null)}
          onSaved={(data) => {
            showToast(
              `✅ Reserva ${data?.reservationNumber || ""} criada com sucesso!`,
              true
            );
            setReservLead(null);
            fetchLeads();
          }}
        />
      )}

      {deleteModal && (
        <DeleteRequestModal
          isOpen={true}
          onClose={() => setDeleteModal(null)}
          entityType="roomLead"
          entityId={deleteModal.id}
          entityLabel={deleteModal.label}
          onSuccess={() => { setDeleteModal(null); fetchLeads(); }}
        />
      )}

      {/* Modal: Ver observações completas */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink2 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-paper">{detail.firstName} {detail.lastName}</h2>
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
    </AdminLayout>
  );
}
