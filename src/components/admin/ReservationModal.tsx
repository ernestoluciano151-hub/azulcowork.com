"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { formatKz } from "@/lib/currency";

export type MeetingPlan = {
  id:                   string;
  name:                 string;
  maxPeople:            number;
  description?:         string | null;
  coffeeBreakAvailable: boolean;
  customPricingAllowed: boolean;
  minHoursForCustom?:   number | null;
  pricePerHour:         number;
  coffeeBreakPrice:     number;
  active:               boolean;
};

export type Reservation = {
  id:                string;
  reservationNumber?: string | null;
  eventName:         string;
  companyName?:      string | null;
  companyId?:        string | null;
  responsible:       string;
  email?:            string | null;
  whatsapp?:         string | null;
  planId:            string;
  plan?:             MeetingPlan;
  participants:      number;
  startDatetime:     string;
  endDatetime:       string;
  totalHours:        number;
  coffeeBreak:       boolean;
  observations?:     string | null;
  status:            string;
  isCustomPricing:   boolean;
  customRequest?:    string | null;
  paymentOption:     string;
  amount:            number;
  discount:          number;
  iva:               number;
  totalAmount:       number;
  paymentStatus:     string;
  paymentMethod?:    string | null;
  operationRef?:     string | null;
  receiptUrl?:       string | null;
  financialNotes?:   string | null;
  paymentId?:        string | null;
  invoiceId?:        string | null;
  createdAt:         string;
};

type Company = { id: string; name: string };

type Props = {
  reservation?: Reservation | null;
  plans:        MeetingPlan[];
  onClose:      () => void;
  onSaved:      () => void;
};

const METHODS = ["Transferência Bancária", "TPA", "Numerário", "Multicaixa Express", "Cheque", "Outro"];

const inp = "w-full rounded-lg border border-white/10 bg-[#0d1829] px-3 py-2.5 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none placeholder:text-[#4b5a77]";
const lbl = "block text-xs font-medium text-[#94A3B8] mb-1";

function toDateTimeLocal(dt: string) {
  return format(new Date(dt), "yyyy-MM-dd'T'HH:mm");
}

export default function ReservationModal({ reservation, plans, onClose, onSaved }: Props) {
  const isCreate = !reservation;
  const today    = new Date().toISOString().split("T")[0];

  // ── Form state ────────────────────────────────────────────────────────────
  const [eventName,       setEventName]       = useState(reservation?.eventName       ?? "");
  const [companyName,     setCompanyName]     = useState(reservation?.companyName     ?? "");
  const [companyId,       setCompanyId]       = useState(reservation?.companyId       ?? "");
  const [responsible,     setResponsible]     = useState(reservation?.responsible     ?? "");
  const [email,           setEmail]           = useState(reservation?.email           ?? "");
  const [whatsapp,        setWhatsapp]        = useState(reservation?.whatsapp        ?? "");
  const [planId,          setPlanId]          = useState(reservation?.planId          ?? (plans[0]?.id || ""));
  const [participants,    setParticipants]    = useState(String(reservation?.participants ?? "1"));
  const [startDatetime,   setStartDatetime]   = useState(reservation?.startDatetime ? toDateTimeLocal(reservation.startDatetime) : "");
  const [endDatetime,     setEndDatetime]     = useState(reservation?.endDatetime   ? toDateTimeLocal(reservation.endDatetime)   : "");
  const [coffeeBreak,     setCoffeeBreak]     = useState(reservation?.coffeeBreak   ?? false);
  const [observations,    setObservations]    = useState(reservation?.observations  ?? "");
  const [isCustomPricing, setIsCustomPricing] = useState(reservation?.isCustomPricing ?? false);
  const [customRequest,   setCustomRequest]   = useState(reservation?.customRequest   ?? "");

  // Financial
  const [paymentOption,   setPaymentOption]   = useState(reservation?.paymentOption ?? "PAGAR_NO_DIA");
  const [discount,        setDiscount]        = useState(String(reservation?.discount  ?? "0"));
  const [ivaPercent,      setIvaPercent]      = useState(String(reservation?.iva       ?? "0"));
  const [paymentMethod,   setPaymentMethod]   = useState(reservation?.paymentMethod ?? "TPA");
  const [operationRef,    setOperationRef]    = useState(reservation?.operationRef   ?? "");
  const [financialNotes,  setFinancialNotes]  = useState(reservation?.financialNotes ?? "");
  const [paidDate,        setPaidDate]        = useState(today);

  // File
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Companies list
  const [companies, setCompanies] = useState<Company[]>([]);

  // Room booking leads for prefill
  type RoomLead = { id: string; firstName: string; lastName: string; email: string; whatsapp: string; company: string | null; participants: number | null; coffeeBreak: boolean; observations: string | null };
  const [roomLeads, setRoomLeads] = useState<RoomLead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");

  // UI
  const [saving,         setSaving]         = useState(false);
  const [confirmCancel,  setConfirmCancel]  = useState(false);
  const [error,          setError]          = useState("");
  const [conflictWarn,   setConflictWarn]   = useState("");
  const [tab,            setTab]            = useState<"reserva" | "financeiro">("reserva");

  useEffect(() => {
    fetch("/api/companies")
      .then(r => r.json())
      .then(d => setCompanies(d.companies || []));
  }, []);

  useEffect(() => {
    fetch("/api/room-booking-leads?status=NOVO&pageSize=50")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.leads) setRoomLeads(d.leads); })
      .catch(() => {});
  }, []);

  function applyLeadPrefill(leadId: string) {
    const lead = roomLeads.find(l => l.id === leadId);
    if (!lead) return;
    setResponsible(`${lead.firstName} ${lead.lastName}`);
    setEmail(lead.email);
    setWhatsapp(lead.whatsapp);
    if (lead.company) setCompanyName(lead.company);
    if (lead.participants) setParticipants(String(lead.participants));
    setCoffeeBreak(lead.coffeeBreak);
    if (lead.observations) setObservations(lead.observations);
    setSelectedLeadId(leadId);
  }

  // Auto-fill from company
  useEffect(() => {
    if (!companyId) return;
    const c = companies.find(x => x.id === companyId);
    if (c && !companyName) setCompanyName(c.name);
  }, [companyId, companies, companyName]);

  // Calculations
  const selectedPlan = plans.find(p => p.id === planId);
  let totalHours = 0;
  if (startDatetime && endDatetime) {
    const diff = new Date(endDatetime).getTime() - new Date(startDatetime).getTime();
    if (diff > 0) totalHours = diff / 3600000;
  }

  const baseAmount    = selectedPlan ? Math.round(selectedPlan.pricePerHour * totalHours * 100) / 100 : 0;
  const cbExtra       = coffeeBreak && selectedPlan ? selectedPlan.coffeeBreakPrice : 0;
  const subtotal      = baseAmount + cbExtra;
  const discountNum   = Math.min(Number(discount) || 0, subtotal);
  const afterDiscount = subtotal - discountNum;
  const ivaNum        = Number(ivaPercent) || 0;
  const ivaAmount     = Math.round((afterDiscount * ivaNum / 100) * 100) / 100;
  const totalAmount   = Math.round((afterDiscount + ivaAmount) * 100) / 100;

  const showCustomPricing = selectedPlan?.customPricingAllowed && totalHours >= (selectedPlan?.minHoursForCustom || 16);
  const participantsWarn  = selectedPlan && Number(participants) > selectedPlan.maxPeople
    ? `Excede a capacidade máx. (${selectedPlan.maxPeople} pessoas)`
    : "";

  // Conflict check
  useEffect(() => {
    if (!startDatetime || !endDatetime) return;
    const s = new Date(startDatetime);
    const e = new Date(endDatetime);
    if (e <= s) return;
    fetch(`/api/reservations?from=${s.toISOString()}&to=${e.toISOString()}&status=CONFIRMADA`)
      .then(r => r.json())
      .then(data => {
        const conflicts = (data.reservations || []).filter((r: Reservation) => {
          if (!isCreate && r.id === reservation?.id) return false;
          return new Date(r.startDatetime).getTime() < e.getTime() &&
                 new Date(r.endDatetime).getTime()   > s.getTime();
        });
        setConflictWarn(conflicts.length > 0 ? "⚠️ Sobreposição com outra reserva neste período." : "");
      })
      .catch(() => {});
  }, [startDatetime, endDatetime, isCreate, reservation?.id]);

  async function uploadFile(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "azul-cowork/salas");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    const d = await res.json();
    return d.url || null;
  }

  async function save() {
    setError("");
    if (!eventName || !responsible || !planId || !startDatetime || !endDatetime) {
      setError("Preencha todos os campos obrigatórios (*).");
      return;
    }
    const s = new Date(startDatetime);
    const e = new Date(endDatetime);
    if (e <= s) { setError("Hora de fim deve ser posterior ao início."); return; }

    setSaving(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        setUploading(true);
        receiptUrl = await uploadFile(receiptFile);
        setUploading(false);
      }

      const payload = {
        eventName, companyName: companyName || null, companyId: companyId || null,
        responsible, email: email || null, whatsapp: whatsapp || null,
        planId, participants: Number(participants),
        startDatetime: s.toISOString(), endDatetime: e.toISOString(),
        coffeeBreak, observations: observations || null,
        isCustomPricing, customRequest: customRequest || null,
        // financial
        paymentOption, amount: subtotal, discount: discountNum, iva: ivaNum,
        totalAmount, paymentMethod, operationRef: operationRef || null,
        receiptUrl, financialNotes: financialNotes || null,
      };

      let res: Response;
      if (isCreate) {
        res = await fetch("/api/reservations", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/reservations/${reservation!.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (res.ok) { onSaved(); onClose(); }
      else setError(data.error || "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function doCancel() {
    await fetch(`/api/reservations/${reservation!.id}`, { method: "DELETE" });
    onSaved(); onClose();
  }

  const payOptCls = (v: string) =>
    `flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium text-center cursor-pointer transition-colors ${
      paymentOption === v
        ? "border-[#2F6FED] bg-[#2F6FED]/20 text-[#5C8FFF]"
        : "border-white/10 text-[#94A3B8] hover:border-white/20 hover:text-white"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1829] shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0d1829] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#F5F7FA]">
              {isCreate ? "Nova Reserva" : `Editar Reserva ${reservation?.reservationNumber || ""}`}
            </h2>
            <p className="text-xs text-[#94A3B8]">Sala de Reunião Azul Cowork</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6">
          {(["reserva", "financeiro"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-[#2F6FED] text-[#5C8FFF]"
                  : "border-transparent text-[#94A3B8] hover:text-white"
              }`}
            >
              {t === "reserva" ? "📅 Reserva" : "💰 Pagamento"}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
        )}
        {conflictWarn && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{conflictWarn}</div>
        )}

        <div className="p-6 space-y-4">

          {/* ── TAB RESERVA ─────────────────────────────────────────────── */}
          {tab === "reserva" && (
            <>
              {/* Prefill from lead */}
              {isCreate && roomLeads.length > 0 && (
                <div className="rounded-lg border border-[#2F6FED]/20 bg-[#2F6FED]/5 px-4 py-3">
                  <label className={lbl}>Preencher com lead de sala...</label>
                  <select
                    value={selectedLeadId}
                    onChange={e => applyLeadPrefill(e.target.value)}
                    className={inp}
                  >
                    <option value="">— Selecionar lead —</option>
                    {roomLeads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.firstName} {l.lastName} — {l.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Empresa */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Empresa (coworking)</label>
                  <select value={companyId} onChange={e => setCompanyId(e.target.value)} className={inp}>
                    <option value="">— Cliente externo —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Nome empresa / organização</label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="Ex: Empresa XYZ Lda" className={inp} />
                </div>
              </div>

              {/* Responsável + contacto */}
              <div>
                <label className={lbl}>Responsável / Contacto *</label>
                <input value={responsible} onChange={e => setResponsible(e.target.value)}
                  placeholder="Nome do responsável" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="email@exemplo.com" className={inp} />
                </div>
                <div>
                  <label className={lbl}>WhatsApp</label>
                  <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                    placeholder="+244 9XX XXX XXX" className={inp} />
                </div>
              </div>

              {/* Evento */}
              <div>
                <label className={lbl}>Nome do Evento *</label>
                <input value={eventName} onChange={e => setEventName(e.target.value)}
                  placeholder="Ex: Reunião de Conselho, Workshop..." className={inp} />
              </div>

              {/* Plano + participantes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Plano *</label>
                  <select value={planId} onChange={e => setPlanId(e.target.value)} className={inp}>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — máx. {p.maxPeople} pax
                        {p.pricePerHour > 0 ? ` | ${formatKz(p.pricePerHour)}/h` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Participantes</label>
                  <input type="number" min="1" value={participants}
                    onChange={e => setParticipants(e.target.value)} className={inp} />
                  {participantsWarn && <p className="mt-1 text-xs text-amber-300">{participantsWarn}</p>}
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Início *</label>
                  <input type="datetime-local" value={startDatetime}
                    onChange={e => setStartDatetime(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Fim *</label>
                  <input type="datetime-local" value={endDatetime}
                    onChange={e => setEndDatetime(e.target.value)} className={inp} />
                </div>
              </div>

              {totalHours > 0 && (
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-[#94A3B8]">
                  Duração: <span className="font-semibold text-[#F5F7FA]">{totalHours.toFixed(2)} horas</span>
                  {selectedPlan?.pricePerHour ? (
                    <span className="ml-3 text-[#5C8FFF]">≈ {formatKz(baseAmount)} base</span>
                  ) : null}
                </div>
              )}

              {/* Coffee break */}
              {selectedPlan?.coffeeBreakAvailable && (
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
                  <input type="checkbox" id="cb" checked={coffeeBreak}
                    onChange={e => setCoffeeBreak(e.target.checked)}
                    className="rounded border-white/20 w-4 h-4 cursor-pointer" />
                  <label htmlFor="cb" className="text-sm text-[#F5F7FA] cursor-pointer flex-1">
                    ☕ Coffee Break
                    {selectedPlan.coffeeBreakPrice > 0 && (
                      <span className="ml-2 text-xs text-[#94A3B8]">+{formatKz(selectedPlan.coffeeBreakPrice)}</span>
                    )}
                  </label>
                </div>
              )}

              {/* Observações */}
              <div>
                <label className={lbl}>Observações</label>
                <textarea value={observations} onChange={e => setObservations(e.target.value)}
                  rows={2} placeholder="Requisitos especiais, configuração da sala..."
                  className={`${inp} resize-none`} />
              </div>

              {/* Custom pricing */}
              {showCustomPricing && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="cp" checked={isCustomPricing}
                      onChange={e => setIsCustomPricing(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 cursor-pointer" />
                    <label htmlFor="cp" className="text-sm font-medium text-amber-300 cursor-pointer">
                      Solicitar preço personalizado
                    </label>
                  </div>
                  {isCustomPricing && (
                    <textarea value={customRequest} onChange={e => setCustomRequest(e.target.value)}
                      rows={2} placeholder="Descreva as necessidades do evento..."
                      className={`${inp} resize-none border-amber-500/20`} />
                  )}
                </div>
              )}
            </>
          )}

          {/* ── TAB FINANCEIRO ──────────────────────────────────────────── */}
          {tab === "financeiro" && (
            <>
              {/* Resumo de preço */}
              {selectedPlan && (
                <div className="rounded-xl border border-[#2F6FED]/25 bg-[#2F6FED]/5 p-4 space-y-2">
                  <p className="text-xs font-semibold text-[#5C8FFF] uppercase tracking-wider">Resumo do Valor</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-[#94A3B8]">
                      <span>{totalHours.toFixed(1)}h × {formatKz(selectedPlan.pricePerHour)}/h</span>
                      <span className="text-[#F5F7FA]">{formatKz(baseAmount)}</span>
                    </div>
                    {coffeeBreak && selectedPlan.coffeeBreakPrice > 0 && (
                      <div className="flex justify-between text-[#94A3B8]">
                        <span>☕ Coffee Break</span>
                        <span className="text-[#F5F7FA]">+{formatKz(cbExtra)}</span>
                      </div>
                    )}
                    {discountNum > 0 && (
                      <div className="flex justify-between text-emerald-300">
                        <span>Desconto</span>
                        <span>−{formatKz(discountNum)}</span>
                      </div>
                    )}
                    {ivaNum > 0 && (
                      <div className="flex justify-between text-[#94A3B8]">
                        <span>IVA ({ivaNum}%)</span>
                        <span className="text-[#F5F7FA]">+{formatKz(ivaAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[#F5F7FA] border-t border-white/10 pt-2 mt-1">
                      <span>TOTAL</span>
                      <span className="text-[#5C8FFF] text-base">{formatKz(totalAmount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Discount + IVA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Desconto (Kz)</label>
                  <input type="number" min="0" step="0.01" value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    placeholder="0,00" className={inp} />
                </div>
                <div>
                  <label className={lbl}>IVA (%)</label>
                  <select value={ivaPercent} onChange={e => setIvaPercent(e.target.value)} className={inp}>
                    <option value="0">Isento de IVA (0%)</option>
                    <option value="14">14%</option>
                    <option value="7">7%</option>
                  </select>
                </div>
              </div>

              {/* Payment option */}
              <div>
                <label className={lbl}>Opção de Pagamento *</label>
                <div className="flex gap-2 mt-1">
                  {[
                    { v: "PAGAR_AGORA",  l: "💳 Pagar Agora"   },
                    { v: "PAGAR_NO_DIA", l: "📅 Pagar no Dia"  },
                    { v: "FACTURAR",     l: "🧾 Facturar"      },
                    { v: "ISENTO",       l: "✅ Isento"         },
                  ].map(({ v, l }) => (
                    <button key={v} type="button" onClick={() => setPaymentOption(v)} className={payOptCls(v)}>
                      {l}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-[#94A3B8]">
                  {paymentOption === "PAGAR_AGORA"  && "Pagamento confirmado agora. Factura e recibo gerados automaticamente."}
                  {paymentOption === "PAGAR_NO_DIA" && "Reserva confirmada. Pagamento registado no dia do evento com um clique."}
                  {paymentOption === "FACTURAR"     && "Factura emitida imediatamente. Pagamento a regularizar posteriormente."}
                  {paymentOption === "ISENTO"       && "Reserva gratuita / cortesia. Sem registo financeiro."}
                </p>
              </div>

              {/* Payment details — shown only for PAGAR_AGORA */}
              {paymentOption === "PAGAR_AGORA" && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <p className="text-xs font-semibold text-[#5C8FFF] uppercase tracking-wider">Detalhes do Pagamento</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Método</label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inp}>
                        {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Data do Pagamento</label>
                      <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className={inp} />
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Referência da Operação</label>
                    <input value={operationRef} onChange={e => setOperationRef(e.target.value)}
                      placeholder="Ex: REF-TPA-20260704-0001" className={inp} />
                  </div>

                  <div>
                    <label className={lbl}>
                      Comprovativo <span className="text-[#5C8FFF]">(PDF, PNG, JPG)</span>
                    </label>
                    <div onClick={() => receiptRef.current?.click()}
                      className="cursor-pointer rounded-lg border-2 border-dashed border-white/15 hover:border-[#2F6FED]/50 px-4 py-3 text-center transition-colors">
                      {receiptFile
                        ? <p className="text-sm text-emerald-300">✓ {receiptFile.name}</p>
                        : <p className="text-xs text-[#94A3B8]">Clique para anexar comprovativo...</p>}
                    </div>
                    <input ref={receiptRef} type="file" accept=".pdf,.png,.jpg,.jpeg"
                      className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={lbl}>Notas Financeiras</label>
                <textarea value={financialNotes} onChange={e => setFinancialNotes(e.target.value)}
                  rows={2} placeholder="Observações sobre o pagamento..."
                  className={`${inp} resize-none`} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0d1829] border-t border-white/10 px-6 py-4 flex items-center justify-between">
          {!isCreate && !confirmCancel && (
            <button onClick={() => setConfirmCancel(true)}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10">
              Cancelar reserva
            </button>
          )}
          {!isCreate && confirmCancel && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-400">Confirmar cancelamento?</span>
              <button onClick={doCancel}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600">
                Sim
              </button>
              <button onClick={() => setConfirmCancel(false)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-[#94A3B8] hover:bg-white/5">
                Não
              </button>
            </div>
          )}
          {isCreate && <div />}

          <div className="flex gap-3">
            <button onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5">
              Fechar
            </button>
            <button onClick={save} disabled={saving || uploading}
              className="rounded-xl bg-[#2F6FED] px-6 py-2 text-sm font-semibold text-white hover:bg-[#1E4FB8] disabled:opacity-50 min-w-[140px]">
              {uploading ? "A enviar ficheiro..." : saving ? "A guardar..." : isCreate ? "Criar Reserva" : "Guardar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
