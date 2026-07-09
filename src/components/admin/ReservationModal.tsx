"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { formatKz } from "@/lib/currency";
import { calcPrice, calcPriceFromTier, matchTier, priceModeLabel, RoomPricingTier } from "@/lib/pricing-service";

// ── Types ──────────────────────────────────────────────────────────────────────
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
  halfDayPrice:         number;
  fullDayPrice:         number;
  weekendPrice:         number;
  promoPrice:           number;
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
  amountPaid:        number;
  paymentStatus:     string;
  paymentMethod?:    string | null;
  operationRef?:     string | null;
  receiptUrl?:       string | null;
  financialNotes?:   string | null;
  paymentId?:        string | null;
  invoiceId?:        string | null;
  createdAt:         string;
};

type Company = {
  id: string; name: string; nif?: string | null;
  responsible: string; email: string; whatsapp: string;
};

type RoomLead = {
  id: string; firstName: string; lastName: string;
  email: string; whatsapp: string; company: string | null;
  participants: number | null; coffeeBreak: boolean; observations: string | null;
  planName?: string | null;
};

type Props = {
  reservation?: Reservation | null;
  plans:        MeetingPlan[];
  onClose:      () => void;
  onSaved:      () => void;
};

type PaymentTiming = "TOTAL" | "PARCIAL" | "POSTERIOR";

const METHODS = ["TPA", "Transferência Bancária", "Depósito Bancário", "Numerário", "Multicaixa Express", "Cheque", "Outro"];
const IVA_OPTS = [{ v: "0", l: "Isento de IVA (0%)" }, { v: "7", l: "7%" }, { v: "14", l: "14%" }];

const inp = "w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2.5 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none placeholder:text-[#4b5a77]";
const lbl = "block text-xs font-medium text-[#94A3B8] mb-1";

function toDateTimeLocal(dt: string) {
  return format(new Date(dt), "yyyy-MM-dd'T'HH:mm");
}

function minutesToHuman(m: number): string {
  if (m < 60)       return `${m} min`;
  if (m === 60)     return "1 hora";
  if (m % 60 === 0) return `${m / 60} horas`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

export default function ReservationModal({ reservation, plans, onClose, onSaved }: Props) {
  const isCreate = !reservation;
  const today    = new Date().toISOString().split("T")[0];

  // ── Reserva fields ────────────────────────────────────────────────────────────
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

  // ── Payment fields ─────────────────────────────────────────────────────────────
  const [paymentOption,   setPaymentOption]   = useState(reservation?.paymentOption ?? "PAGAR_NO_DIA");
  const [paymentTiming,   setPaymentTiming]   = useState<PaymentTiming>("TOTAL");
  const [discount,        setDiscount]        = useState(String(reservation?.discount  ?? "0"));
  const [ivaPercent,      setIvaPercent]      = useState(String(reservation?.iva       ?? "0"));
  const [paymentMethod,   setPaymentMethod]   = useState(reservation?.paymentMethod ?? "TPA");
  const [operationRef,    setOperationRef]    = useState(reservation?.operationRef   ?? "");
  const [financialNotes,  setFinancialNotes]  = useState(reservation?.financialNotes ?? "");
  const [paidDate,        setPaidDate]        = useState(today);
  const [amountPaidInput, setAmountPaidInput] = useState("");

  // ── File upload ────────────────────────────────────────────────────────────────
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // ── Data ───────────────────────────────────────────────────────────────────────
  const [companies,      setCompanies]      = useState<Company[]>([]);
  const [roomLeads,      setRoomLeads]      = useState<RoomLead[]>([]);
  const [pricingTiers,   setPricingTiers]   = useState<RoomPricingTier[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [companySearch,  setCompanySearch]  = useState("");

  // ── UI ─────────────────────────────────────────────────────────────────────────
  const [saving,        setSaving]        = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error,         setError]         = useState("");
  const [conflictWarn,  setConflictWarn]  = useState("");
  const [tab,           setTab]           = useState<"reserva" | "financeiro">("reserva");
  const [successInfo,   setSuccessInfo]   = useState<{ reservationNumber: string; invoiceNumber?: string; noteNumber?: string } | null>(null);

  // ── Fetch data on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/companies?limit=200").then(r => r.json()),
      fetch("/api/room-booking-leads?status=NOVO&pageSize=50").then(r => r.ok ? r.json() : { leads: [] }).catch(() => ({ leads: [] })),
      fetch("/api/admin/room-pricing?roomId=sala-reuniao").then(r => r.json()),
    ]).then(([co, leads, pricing]) => {
      setCompanies(co.companies || []);
      setRoomLeads(leads.leads || []);
      setPricingTiers(pricing.tiers || []);
    });
  }, []);

  // ── Auto-fill company ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return;
    const c = companies.find(x => x.id === companyId);
    if (c) {
      setCompanyName(c.name);
      if (!responsible) setResponsible(c.responsible);
      if (!email)       setEmail(c.email);
      if (!whatsapp)    setWhatsapp(c.whatsapp);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, companies]);

  // ── Lead prefill ──────────────────────────────────────────────────────────────
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
    if (lead.planName) {
      const matched = plans.find(p => p.name.toLowerCase() === lead.planName?.toLowerCase());
      if (matched) setPlanId(matched.id);
    }
    setSelectedLeadId(leadId);
  }

  // ── Duration + pricing calculation ────────────────────────────────────────────
  const selectedPlan = plans.find(p => p.id === planId);

  let totalHours      = 0;
  let durationMinutes = 0;
  let startDate: Date | undefined;

  if (startDatetime && endDatetime) {
    const s = new Date(startDatetime);
    const e = new Date(endDatetime);
    const diff = e.getTime() - s.getTime();
    if (diff > 0) {
      totalHours      = diff / 3600000;
      durationMinutes = Math.round(diff / 60000);
      startDate       = s;
    }
  }

  // Try DB pricing tiers first, fall back to plan-level pricing
  const matchedTier  = durationMinutes > 0 && pricingTiers.length > 0
    ? matchTier(pricingTiers, durationMinutes)
    : undefined;

  const pricing = (() => {
    if (!selectedPlan || durationMinutes === 0) return null;
    if (matchedTier) {
      return calcPriceFromTier(
        matchedTier,
        selectedPlan.coffeeBreakPrice,
        coffeeBreak,
        Number(discount) || 0,
        Number(ivaPercent) || 0
      );
    }
    // Fallback: plan-level prices
    if (selectedPlan.pricePerHour > 0 || selectedPlan.halfDayPrice > 0 || selectedPlan.fullDayPrice > 0) {
      return calcPrice({
        plan:       selectedPlan,
        totalHours,
        coffeeBreak,
        discount:   Number(discount) || 0,
        ivaPercent: Number(ivaPercent) || 0,
        startDate,
      });
    }
    return null;
  })();

  const noTierConfigured = durationMinutes > 0 && !pricing && pricingTiers.length > 0;
  const noPricingAtAll   = durationMinutes > 0 && !pricing && pricingTiers.length === 0;

  const totalAmount   = pricing?.totalAmount ?? 0;
  const discountNum   = pricing?.discountApplied ?? 0;
  const amountPaidNum = paymentTiming === "PARCIAL" ? (parseFloat(amountPaidInput) || 0)
                      : paymentTiming === "TOTAL"   ? totalAmount : 0;
  const balance       = Math.max(0, totalAmount - amountPaidNum);
  const paidPct       = totalAmount > 0 ? Math.min(100, (amountPaidNum / totalAmount) * 100) : 0;

  const showCustomPricing = selectedPlan?.customPricingAllowed && totalHours >= (selectedPlan?.minHoursForCustom || 16);
  const participantsWarn  = selectedPlan && Number(participants) > selectedPlan.maxPeople
    ? `Excede a capacidade máx. (${selectedPlan.maxPeople} pessoas)` : "";

  // ── Conflict check ────────────────────────────────────────────────────────────
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

  // ── Upload ────────────────────────────────────────────────────────────────────
  async function uploadFile(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file); fd.append("folder", "azul-cowork/salas");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    return (await res.json()).url || null;
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function save() {
    setError("");
    if (!eventName || !responsible || !planId || !startDatetime || !endDatetime) {
      setError("Preencha todos os campos obrigatórios (*)."); return;
    }
    const s = new Date(startDatetime);
    const e = new Date(endDatetime);
    if (e <= s) { setError("Hora de fim deve ser posterior ao início."); return; }
    if (paymentTiming === "PARCIAL" && amountPaidNum <= 0) {
      setError("Insira o valor pago para pagamento parcial."); return;
    }

    setSaving(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) { setUploading(true); receiptUrl = await uploadFile(receiptFile); setUploading(false); }

      let finalPaymentOption = paymentOption;
      if (paymentOption === "PAGAR_AGORA" && paymentTiming === "POSTERIOR") finalPaymentOption = "PAGAR_NO_DIA";

      const payload = {
        eventName, companyName: companyName || null, companyId: companyId || null,
        responsible, email: email || null, whatsapp: whatsapp || null,
        planId, participants: Number(participants),
        startDatetime: s.toISOString(), endDatetime: e.toISOString(),
        coffeeBreak, observations: observations || null,
        isCustomPricing, customRequest: customRequest || null,
        paymentOption:  finalPaymentOption,
        amount:         pricing?.subtotal ?? 0,
        discount:       discountNum,
        iva:            Number(ivaPercent) || 0,
        totalAmount,
        amountPaid:     amountPaidNum,
        paymentTiming,
        paymentMethod:  finalPaymentOption === "PAGAR_AGORA" ? paymentMethod : null,
        operationRef:   finalPaymentOption === "PAGAR_AGORA" ? (operationRef || null) : null,
        paidDate:       finalPaymentOption === "PAGAR_AGORA" ? paidDate : null,
        receiptUrl:     finalPaymentOption === "PAGAR_AGORA" ? receiptUrl : null,
        financialNotes: financialNotes || null,
        selectedLeadId: selectedLeadId || null,
        // Pass pricing tier info for accurate records
        matchedTierLabel: matchedTier?.label || null,
      };

      const res = isCreate
        ? await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch(`/api/reservations/${reservation!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      const data = await res.json();
      if (res.ok) {
        setSuccessInfo({
          reservationNumber: data.reservation?.reservationNumber || data.reservationNumber || "",
          invoiceNumber:     data.invoice?.invoiceNumber,
          noteNumber:        data.noteNumber,
        });
        setTimeout(() => { onSaved(); onClose(); }, 2500);
      } else {
        setError(data.error || "Erro ao guardar.");
      }
    } finally { setSaving(false); }
  }

  async function doCancel() {
    await fetch(`/api/reservations/${reservation!.id}`, { method: "DELETE" });
    onSaved(); onClose();
  }

  const payOptCls = (v: string) =>
    `flex-1 rounded-lg border px-2 py-2 text-xs font-medium text-center cursor-pointer transition-colors ${
      paymentOption === v
        ? "border-[#2F6FED] bg-[#2F6FED]/20 text-[#5C8FFF]"
        : "border-white/10 text-[#94A3B8] hover:border-white/20 hover:text-white"
    }`;

  const timingCls = (v: PaymentTiming) =>
    `flex-1 rounded-lg border px-2 py-2 text-xs font-medium text-center cursor-pointer transition-colors ${
      paymentTiming === v
        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
        : "border-white/10 text-[#94A3B8] hover:border-white/20"
    }`;

  const filteredCompanies = companySearch
    ? companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
    : companies;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1829] shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0d1829] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#F5F7FA]">
              {isCreate ? "Nova Reserva" : `Editar — ${reservation?.reservationNumber || ""}`}
            </h2>
            <p className="text-xs text-[#94A3B8]">Sala de Reunião · Azul Cowork</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6">
          {(["reserva", "financeiro"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-[#2F6FED] text-[#5C8FFF]" : "border-transparent text-[#94A3B8] hover:text-white"
              }`}>
              {t === "reserva" ? "📅 Reserva" : `💰 Pagamento${totalAmount > 0 ? ` · ${formatKz(totalAmount)}` : ""}`}
            </button>
          ))}
        </div>

        {/* Alerts */}
        {error        && <div className="mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        {conflictWarn && <div className="mx-6 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{conflictWarn}</div>}

        {/* Success */}
        {successInfo && (
          <div className="mx-6 mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-emerald-300 font-bold text-sm mb-2">✓ Reserva criada com sucesso!</p>
            <p className="text-xs text-[#94A3B8]">Nº Reserva: <span className="text-[#F5F7FA] font-medium">{successInfo.reservationNumber}</span></p>
            {successInfo.invoiceNumber && <p className="text-xs text-[#94A3B8]">Factura: <span className="text-[#F5F7FA] font-medium">{successInfo.invoiceNumber}</span></p>}
            {successInfo.noteNumber    && <p className="text-xs text-[#94A3B8]">Nota Liquidação: <span className="text-[#F5F7FA] font-medium">{successInfo.noteNumber}</span></p>}
            <p className="text-xs text-[#94A3B8] mt-1">A fechar...</p>
          </div>
        )}

        <div className="p-6 space-y-4">

          {/* ── TAB RESERVA ──────────────────────────────────────────────────── */}
          {tab === "reserva" && (
            <>
              {/* Lead selector */}
              {isCreate && roomLeads.length > 0 && (
                <div className="rounded-xl border border-[#2F6FED]/20 bg-[#2F6FED]/5 px-4 py-3">
                  <label className={lbl}>🔗 Importar de Lead</label>
                  <select value={selectedLeadId} onChange={e => applyLeadPrefill(e.target.value)} className={inp}>
                    <option value="">— Selecionar lead existente —</option>
                    {roomLeads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.firstName} {l.lastName}{l.company ? ` — ${l.company}` : ""} · {l.email}
                      </option>
                    ))}
                  </select>
                  {selectedLeadId && <p className="text-xs text-emerald-300 mt-1.5">✓ Dados preenchidos a partir do lead</p>}
                </div>
              )}

              {/* Company */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Empresa (membro coworking)</label>
                  <input value={companySearch} onChange={e => setCompanySearch(e.target.value)}
                    placeholder="Filtrar..." className={`${inp} mb-1.5`} />
                  <select value={companyId} onChange={e => { setCompanyId(e.target.value); setCompanySearch(""); }} className={inp}>
                    <option value="">— Cliente externo —</option>
                    {filteredCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Nome empresa / organização</label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="Ex: Empresa XYZ Lda" className={inp} />
                </div>
              </div>

              {/* Responsible */}
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

              {/* Event */}
              <div>
                <label className={lbl}>Nome do Evento *</label>
                <input value={eventName} onChange={e => setEventName(e.target.value)}
                  placeholder="Ex: Reunião de Conselho, Workshop..." className={inp} />
              </div>

              {/* Plan + participants */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Plano *</label>
                  <select value={planId} onChange={e => setPlanId(e.target.value)} className={inp}>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — máx. {p.maxPeople} pax
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

              {/* Datetime */}
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

              {/* ── Smart duration + price preview card ── */}
              {durationMinutes > 0 && (
                <div className={`rounded-xl border p-4 ${pricing ? "border-[#2F6FED]/30 bg-[#2F6FED]/5" : noTierConfigured ? "border-amber-500/30 bg-amber-500/5" : "border-white/10 bg-white/[0.02]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-[#94A3B8]">⏱</span>
                        <span className="text-[#F5F7FA] font-medium">{minutesToHuman(durationMinutes)}</span>
                        <span className="text-[#94A3B8]">
                          ({startDatetime && endDatetime
                            ? `${format(new Date(startDatetime), "HH:mm")} às ${format(new Date(endDatetime), "HH:mm")}`
                            : ""})
                        </span>
                      </div>

                      {pricing && matchedTier && (
                        <>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-[#94A3B8]">📋 Plano aplicado:</span>
                            <span className="rounded-full bg-[#2F6FED]/15 border border-[#2F6FED]/30 px-2 py-0.5 text-xs text-[#5C8FFF] font-medium">
                              {matchedTier.label}
                            </span>
                            {matchedTier.durationMinutes !== durationMinutes && (
                              <span className="text-xs text-[#94A3B8]">
                                (mais próximo: {minutesToHuman(matchedTier.durationMinutes)})
                              </span>
                            )}
                          </div>
                          <div className="text-sm">
                            <span className="text-[#94A3B8]">💰 Preço: </span>
                            <span className="text-[#5C8FFF] font-bold text-base">{formatKz(matchedTier.price)}</span>
                          </div>
                        </>
                      )}

                      {pricing && !matchedTier && (
                        <div className="text-sm">
                          <span className="text-[#94A3B8]">💰 Preço: </span>
                          <span className="text-[#5C8FFF] font-bold text-base">{formatKz(pricing.totalAmount)}</span>
                          <span className="ml-2 text-xs rounded-full bg-[#2F6FED]/10 border border-[#2F6FED]/20 px-2 py-0.5 text-[#5C8FFF]">
                            {priceModeLabel(pricing.priceMode, pricing.tierLabel)}
                          </span>
                        </div>
                      )}

                      {noTierConfigured && (
                        <div className="text-sm text-amber-300">
                          ⚠️ Não existe um preço definido para {minutesToHuman(durationMinutes)}.
                        </div>
                      )}
                      {noPricingAtAll && (
                        <div className="text-sm text-amber-300">
                          ⚠️ Sem preços configurados para esta sala.
                        </div>
                      )}
                    </div>

                    {(noTierConfigured || noPricingAtAll) && (
                      <a href="/admin/configuracoes/precos" target="_blank"
                        className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/20 transition-colors">
                        Configurar Preços →
                      </a>
                    )}
                  </div>
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

              <div>
                <label className={lbl}>Observações</label>
                <textarea value={observations} onChange={e => setObservations(e.target.value)}
                  rows={2} placeholder="Requisitos especiais, configuração da sala..."
                  className={`${inp} resize-none`} />
              </div>

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

          {/* ── TAB FINANCEIRO ────────────────────────────────────────────────── */}
          {tab === "financeiro" && (
            <>
              {/* Price breakdown */}
              <div className={`rounded-xl border p-4 space-y-2 ${pricing ? "border-[#2F6FED]/25 bg-[#2F6FED]/5" : "border-amber-500/25 bg-amber-500/5"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#5C8FFF] uppercase tracking-wider">Resumo do Valor</p>
                  {pricing && (
                    <span className="rounded-full bg-[#2F6FED]/15 border border-[#2F6FED]/30 px-2 py-0.5 text-xs text-[#5C8FFF]">
                      {priceModeLabel(pricing.priceMode, pricing.tierLabel)}
                    </span>
                  )}
                </div>

                {pricing ? (
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-[#94A3B8]">
                      <span>
                        {pricing.priceMode === "tier"
                          ? `${pricing.tierLabel} · ${minutesToHuman(durationMinutes)}`
                          : `${totalHours.toFixed(1)}h × preço base`}
                      </span>
                      <span className="text-[#F5F7FA]">{formatKz(pricing.baseAmount)}</span>
                    </div>
                    {coffeeBreak && pricing.coffeeExtra > 0 && (
                      <div className="flex justify-between text-[#94A3B8]">
                        <span>☕ Coffee Break</span>
                        <span className="text-[#F5F7FA]">+{formatKz(pricing.coffeeExtra)}</span>
                      </div>
                    )}
                    {pricing.discountApplied > 0 && (
                      <div className="flex justify-between text-emerald-300">
                        <span>Desconto</span><span>−{formatKz(pricing.discountApplied)}</span>
                      </div>
                    )}
                    {Number(ivaPercent) > 0 && (
                      <div className="flex justify-between text-[#94A3B8]">
                        <span>IVA ({ivaPercent}%)</span>
                        <span className="text-[#F5F7FA]">+{formatKz(pricing.ivaAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[#F5F7FA] border-t border-white/10 pt-2 mt-1">
                      <span>TOTAL</span>
                      <span className="text-[#5C8FFF] text-lg">{formatKz(pricing.totalAmount)}</span>
                    </div>
                  </div>
                ) : durationMinutes > 0 ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-amber-300">
                      ⚠️ Não existe um preço definido para {minutesToHuman(durationMinutes)}.
                    </p>
                    <a href="/admin/configuracoes/precos" target="_blank"
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/20">
                      Configurar Preços →
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-[#94A3B8]">
                    Defina o horário na aba Reserva para calcular o valor automaticamente.
                  </p>
                )}
              </div>

              {/* Discount + IVA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Desconto (AOA)</label>
                  <input type="number" min="0" step="100" value={discount}
                    onChange={e => setDiscount(e.target.value)} placeholder="0" className={inp} />
                </div>
                <div>
                  <label className={lbl}>IVA (%)</label>
                  <select value={ivaPercent} onChange={e => setIvaPercent(e.target.value)} className={inp}>
                    {IVA_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              </div>

              {/* Payment option */}
              <div>
                <label className={lbl}>Opção de Pagamento *</label>
                <div className="flex gap-2 mt-1">
                  {[
                    { v: "PAGAR_AGORA",  l: "💳 Pagar Agora" },
                    { v: "PAGAR_NO_DIA", l: "📅 Pagar no Dia" },
                    { v: "FACTURAR",     l: "🧾 Facturar" },
                    { v: "ISENTO",       l: "✅ Isento" },
                  ].map(({ v, l }) => (
                    <button key={v} type="button" onClick={() => setPaymentOption(v)} className={payOptCls(v)}>{l}</button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-[#94A3B8]">
                  {paymentOption === "PAGAR_AGORA"  && "Pagamento confirmado agora. Factura, Nota de Liquidação e Recibo gerados automaticamente."}
                  {paymentOption === "PAGAR_NO_DIA" && "Reserva confirmada. Pagamento registado no dia do evento com um clique."}
                  {paymentOption === "FACTURAR"     && "Factura emitida imediatamente. Pagamento a regularizar posteriormente."}
                  {paymentOption === "ISENTO"       && "Reserva gratuita / cortesia. Sem registo financeiro."}
                </p>
              </div>

              {/* Payment timing — PAGAR_AGORA only */}
              {paymentOption === "PAGAR_AGORA" && (
                <div>
                  <label className={lbl}>Recebimento</label>
                  <div className="flex gap-2">
                    {([
                      { v: "TOTAL",     l: "✓ Pagamento Total" },
                      { v: "PARCIAL",   l: "◑ Pagamento Parcial" },
                      { v: "POSTERIOR", l: "⏳ Pagamento Posterior" },
                    ] as { v: PaymentTiming; l: string }[]).map(({ v, l }) => (
                      <button key={v} type="button" onClick={() => setPaymentTiming(v)} className={timingCls(v)}>{l}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Partial payment detail */}
              {paymentOption === "PAGAR_AGORA" && paymentTiming === "PARCIAL" && totalAmount > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Pagamento Parcial</p>
                  <div>
                    <label className={lbl}>Valor Pago Agora (AOA)</label>
                    <input type="number" min="0" max={totalAmount} step="100"
                      value={amountPaidInput} onChange={e => setAmountPaidInput(e.target.value)}
                      placeholder={`Máx: ${formatKz(totalAmount)}`} className={inp} />
                  </div>
                  {amountPaidNum > 0 && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3 text-xs bg-[#0B1220] rounded-lg p-3">
                        <div><p className="text-[#94A3B8] mb-0.5">Valor Total</p><p className="text-[#F5F7FA] font-bold text-sm">{formatKz(totalAmount)}</p></div>
                        <div><p className="text-[#94A3B8] mb-0.5">Valor Pago</p><p className="text-emerald-300 font-bold text-sm">{formatKz(amountPaidNum)}</p></div>
                        <div><p className="text-[#94A3B8] mb-0.5">Saldo em Dívida</p><p className="text-amber-300 font-bold text-sm">{formatKz(balance)}</p></div>
                        <div><p className="text-[#94A3B8] mb-0.5">% Liquidada</p><p className="text-[#5C8FFF] font-bold text-sm">{paidPct.toFixed(1)}%</p></div>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-[#2F6FED] transition-all" style={{ width: `${paidPct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Payment details form */}
              {paymentOption === "PAGAR_AGORA" && paymentTiming !== "POSTERIOR" && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <p className="text-xs font-semibold text-[#5C8FFF] uppercase tracking-wider">Detalhes do Pagamento</p>

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-[#0B1220] rounded-lg p-3">
                    <div><p className="text-[#94A3B8] mb-0.5">Valor Total</p><p className="text-[#F5F7FA] font-bold">{formatKz(totalAmount)}</p></div>
                    <div><p className="text-[#94A3B8] mb-0.5">Valor Pago</p><p className="text-emerald-300 font-bold">{formatKz(amountPaidNum)}</p></div>
                    {balance > 0 && <>
                      <div><p className="text-[#94A3B8] mb-0.5">Valor em Dívida</p><p className="text-amber-300 font-bold">{formatKz(balance)}</p></div>
                      <div><p className="text-[#94A3B8] mb-0.5">% Liquidada</p><p className="text-[#5C8FFF] font-bold">{paidPct.toFixed(1)}%</p></div>
                    </>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Método de Pagamento</label>
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
                      placeholder="Ex: REF-TPA-20260709-0001" className={inp} />
                  </div>

                  <div>
                    <label className={lbl}>Comprovativo <span className="text-[#5C8FFF]">(PDF, PNG, JPG, JPEG)</span></label>
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
              <button onClick={doCancel} className="rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white">Sim</button>
              <button onClick={() => setConfirmCancel(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-[#94A3B8]">Não</button>
            </div>
          )}
          {isCreate && <div />}

          <div className="flex gap-3 items-center">
            {pricing && totalAmount > 0 && (
              <div className="text-right mr-2">
                <p className="text-xs text-[#94A3B8]">Total a pagar</p>
                <p className="text-base font-bold text-[#5C8FFF]">{formatKz(totalAmount)}</p>
              </div>
            )}
            <button onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5">
              Fechar
            </button>
            <button onClick={save} disabled={saving || uploading || !!successInfo}
              className="rounded-xl bg-[#2F6FED] px-6 py-2 text-sm font-semibold text-white hover:bg-[#1E4FB8] disabled:opacity-50 min-w-[140px]">
              {uploading ? "A enviar..." : saving ? "A guardar..." : successInfo ? "✓ Criado!" : isCreate ? "Criar Reserva" : "Guardar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
