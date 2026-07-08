"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/admin/Sidebar";
import ReservationModal from "@/components/admin/ReservationModal";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
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
  company?:          { id: string; name: string } | null;
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
  paymentId?:        string | null;
  invoiceId?:        string | null;
  createdAt:         string;
};

type SalaKPIs = {
  receitaHoje:         number;
  reservasHoje:        number;
  receitaMes:          number;
  receitaMesTotal:     number;
  reservasMes:         number;
  confirmadasMes:      number;
  pendentesMes:        number;
  horasVendidasMes:    number;
  horasDisponiveisMes: number;
  taxaOcupacao:        number;
  valorMedioReserva:   number;
  topPlan:             string;
  topCompany:          string;
  totalPendente:       number;
  countPendente:       number;
};

// ── Receive Payment Modal ───────────────────────────────────────────────────
function ReceivePaymentModal({ reservation, onClose, onSaved }: {
  reservation: Reservation; onClose: () => void; onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [method,  setMethod]  = useState("TPA");
  const [ref,     setRef]     = useState("");
  const [date,    setDate]    = useState(today);
  const [amount,  setAmount]  = useState(reservation.totalAmount > 0 ? String(reservation.totalAmount) : "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState<{ invoiceNumber: string; noteNumber: string; balance: number; invoiceStatus: string } | null>(null);

  const inp = "w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2.5 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none";
  const lbl = "block text-xs font-medium text-[#94A3B8] mb-1";

  const amountNum = parseFloat(amount.replace(/\s/g, "").replace(",", ".")) || 0;
  const isPartial = reservation.totalAmount > 0 && amountNum < reservation.totalAmount;

  async function confirm() {
    if (amountNum <= 0) { setError("Insira um valor válido."); return; }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/reservations/${reservation.id}/receive-payment`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ paymentMethod: method, operationRef: ref || null, paidDate: date, amount: amountNum }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json();
      setResult(d);
      setTimeout(() => { onSaved(); onClose(); }, 2000);
    } else {
      const d = await res.json();
      setError(d.error || "Erro ao registar.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1829] p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-[#F5F7FA] mb-1">Receber Pagamento</h3>
        <p className="text-xs text-[#94A3B8] mb-4">
          {reservation.reservationNumber} — {reservation.eventName}
        </p>

        {result ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 mb-4 text-center">
            <p className="text-emerald-300 font-bold text-base mb-1">✓ Pagamento Registado</p>
            <p className="text-xs text-[#94A3B8]">Factura: <span className="text-[#F5F7FA]">{result.invoiceNumber}</span></p>
            <p className="text-xs text-[#94A3B8]">Nota de Liquidação: <span className="text-[#F5F7FA]">{result.noteNumber}</span></p>
            {result.balance > 0 && (
              <p className="text-xs text-amber-300 mt-1">Saldo em dívida: {formatKz(result.balance)}</p>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-[#2F6FED]/25 bg-[#2F6FED]/5 p-4 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#94A3B8]">Total da reserva</span>
                <span className="font-bold text-[#5C8FFF] text-base">
                  {reservation.totalAmount > 0 ? formatKz(reservation.totalAmount) : <span className="text-amber-300">Sem preço definido</span>}
                </span>
              </div>
              <div className="flex justify-between text-xs text-[#94A3B8] mt-1">
                <span>{reservation.plan?.name} · {reservation.totalHours.toFixed(1)}h</span>
                <span>{format(new Date(reservation.startDatetime), "dd/MM/yyyy HH:mm")}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className={lbl}>
                  Valor Recebido (AOA)
                  {isPartial && <span className="ml-2 text-amber-400">— Pagamento parcial</span>}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={inp}
                />
                {isPartial && amountNum > 0 && (
                  <p className="text-xs text-amber-300 mt-1">
                    Saldo remanescente: {formatKz(reservation.totalAmount - amountNum)}
                  </p>
                )}
              </div>
              <div>
                <label className={lbl}>Método de Pagamento</label>
                <select value={method} onChange={e => setMethod(e.target.value)} className={inp}>
                  {["TPA","Transferência Bancária","Numerário","Multicaixa Express","Cheque","Outro"].map(m =>
                    <option key={m} value={m}>{m}</option>
                  )}
                </select>
              </div>
              <div>
                <label className={lbl}>Data do Pagamento</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Referência da Operação</label>
                <input value={ref} onChange={e => setRef(e.target.value)}
                  placeholder="Ex: REF-TPA-0001" className={inp} />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5">
                Cancelar
              </button>
              <button onClick={confirm} disabled={saving || amountNum <= 0}
                className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "A registar..." : `✓ Confirmar ${isPartial ? "Parcial" : "Pagamento"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Status badges ───────────────────────────────────────────────────────────
const RES_STATUS: Record<string, { label: string; cls: string }> = {
  CONFIRMADA:          { label: "Confirmada",     cls: "bg-emerald-500/15 text-emerald-300" },
  RESERVADO:           { label: "Reservado",      cls: "bg-blue-500/15 text-blue-300" },
  CANCELADA:           { label: "Cancelada",      cls: "bg-red-500/15 text-red-300" },
  PENDENTE_APROVACAO:  { label: "Pend. Aprovação",cls: "bg-amber-500/15 text-amber-300" },
  CONCLUIDA:           { label: "Concluída",      cls: "bg-purple-500/15 text-purple-300" },
};

const PAY_STATUS: Record<string, { label: string; cls: string }> = {
  PAGO:      { label: "Pago",      cls: "bg-emerald-500/15 text-emerald-300" },
  PENDENTE:  { label: "Pendente",  cls: "bg-amber-500/15 text-amber-300" },
  FACTURADO: { label: "Facturado", cls: "bg-blue-500/15 text-blue-300" },
  ISENTO:    { label: "Isento",    cls: "bg-purple-500/15 text-purple-300" },
};

const PLAN_COLORS: Record<string, string> = {
  Alpha: "bg-blue-500/15 text-blue-300",
  Beta:  "bg-purple-500/15 text-purple-300",
  Gamma: "bg-emerald-500/15 text-emerald-300",
  Easy:  "bg-teal-500/15 text-teal-300",
  Personalizado: "bg-amber-500/15 text-amber-300",
};

// ── Main page ───────────────────────────────────────────────────────────────
export default function SalasPage() {
  const [plans,        setPlans]        = useState<MeetingPlan[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [kpis,         setKpis]         = useState<SalaKPIs | null>(null);
  const [loading,      setLoading]      = useState(true);

  const [filterStatus,   setFilterStatus]   = useState("ALL");
  const [filterPayStatus,setFilterPayStatus]= useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");

  const [editingRes,      setEditingRes]      = useState<Reservation | null>(null);
  const [creatingRes,     setCreatingRes]     = useState(false);
  const [receivingPayment,setReceivingPayment]= useState<Reservation | null>(null);
  const [expandedRow,     setExpandedRow]     = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus    !== "ALL") params.set("status",        filterStatus);
    if (filterPayStatus !== "ALL") params.set("paymentStatus", filterPayStatus);
    if (filterDateFrom) params.set("from", new Date(filterDateFrom).toISOString());
    if (filterDateTo)   params.set("to",   new Date(filterDateTo + "T23:59:59").toISOString());

    const [plansRes, resRes, kpiRes] = await Promise.all([
      fetch("/api/plans"),
      fetch(`/api/reservations?${params.toString()}`),
      fetch("/api/finance/sala"),
    ]);

    if (plansRes.ok) { const d = await plansRes.json(); setPlans(d.plans); }
    if (resRes.ok)   { const d = await resRes.json();   setReservations(d.reservations); }
    if (kpiRes.ok)   { const d = await kpiRes.json();   setKpis(d); }
    setLoading(false);
  }, [filterStatus, filterPayStatus, filterDateFrom, filterDateTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function approveReservation(id: string) {
    await fetch(`/api/reservations/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMADA" }),
    });
    fetchAll();
  }

  async function rejectReservation(id: string) {
    await fetch(`/api/reservations/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELADA" }),
    });
    fetchAll();
  }

  const pendingApproval = reservations.filter(r => r.status === "PENDENTE_APROVACAO");
  const pendingPayment  = reservations.filter(r => r.paymentStatus === "PENDENTE" && r.status !== "CANCELADA");

  return (
    <div className="flex min-h-screen bg-[#0B1220]">
      <Sidebar />
      <main className="flex-1 p-8 overflow-x-hidden">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#F5F7FA]">Sala de Reunião</h1>
            <p className="text-sm text-[#94A3B8]">Gestão comercial e financeira integrada</p>
          </div>
          <button onClick={() => setCreatingRes(true)}
            className="rounded-lg bg-[#2F6FED] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E4FB8]">
            + Nova Reserva
          </button>
        </div>

        {/* KPIs Row 1 */}
        {kpis && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-medium text-[#94A3B8]">Receita Hoje</p>
                <p className="mt-2 text-2xl font-bold text-[#F5F7FA]">{formatKz(kpis.receitaHoje)}</p>
                <p className="text-xs text-[#94A3B8] mt-1">{kpis.reservasHoje} reservas</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-medium text-[#94A3B8]">Receita do Mês</p>
                <p className="mt-2 text-2xl font-bold text-[#F5F7FA]">{formatKz(kpis.receitaMes)}</p>
                <p className="text-xs text-[#94A3B8] mt-1">{kpis.reservasMes} reservas</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-medium text-[#94A3B8]">Horas Vendidas (mês)</p>
                <p className="mt-2 text-2xl font-bold text-[#F5F7FA]">{kpis.horasVendidasMes.toFixed(0)}h</p>
                <p className="text-xs text-[#94A3B8] mt-1">de {kpis.horasDisponiveisMes}h disponíveis</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-medium text-[#94A3B8]">Taxa de Ocupação</p>
                <p className="mt-2 text-2xl font-bold text-[#F5F7FA]">{kpis.taxaOcupacao}%</p>
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-[#2F6FED]" style={{ width: `${kpis.taxaOcupacao}%` }} />
                </div>
              </div>
            </div>

            {/* KPIs Row 2 */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                <p className="text-xs font-medium text-amber-300">Total Pendente</p>
                <p className="mt-2 text-xl font-bold text-[#F5F7FA]">{formatKz(kpis.totalPendente)}</p>
                <p className="text-xs text-amber-300 mt-1">{kpis.countPendente} reservas por cobrar</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-medium text-[#94A3B8]">Valor Médio Reserva</p>
                <p className="mt-2 text-xl font-bold text-[#F5F7FA]">{formatKz(kpis.valorMedioReserva)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-medium text-[#94A3B8]">Plano Mais Vendido</p>
                <p className="mt-2 text-xl font-bold text-[#5C8FFF]">{kpis.topPlan}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-medium text-[#94A3B8]">Cliente Mais Frequente</p>
                <p className="mt-2 text-lg font-bold text-[#F5F7FA] truncate">{kpis.topCompany}</p>
              </div>
            </div>
          </>
        )}

        {/* Pending payments alert */}
        {pendingPayment.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h3 className="text-sm font-semibold text-amber-300 mb-3">
              ⏳ {pendingPayment.length} reserva{pendingPayment.length > 1 ? "s" : ""} aguarda{pendingPayment.length === 1 ? "" : "m"} pagamento
            </h3>
            <div className="space-y-2">
              {pendingPayment.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between flex-wrap gap-2 bg-white/[0.02] rounded-lg px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium text-[#F5F7FA]">{r.eventName}</span>
                    <span className="text-[#94A3B8] ml-2">{r.companyName || r.company?.name || "—"}</span>
                    <span className="text-[#94A3B8] ml-2 text-xs">
                      {format(new Date(r.startDatetime), "dd/MM HH:mm")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-300">{formatKz(r.totalAmount)}</span>
                    <button onClick={() => setReceivingPayment(r)}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                      Receber
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending approval */}
        {pendingApproval.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h3 className="font-semibold text-amber-300 mb-3">Pedidos Personalizados — Aguardam Aprovação</h3>
            <div className="space-y-3">
              {pendingApproval.map(r => (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 text-sm bg-white/[0.02] rounded-lg p-3">
                  <div>
                    <p className="font-medium text-[#F5F7FA]">{r.eventName}</p>
                    <p className="text-[#94A3B8]">{r.responsible} {r.companyName ? `· ${r.companyName}` : ""}</p>
                    <p className="text-[#94A3B8] text-xs">
                      {format(new Date(r.startDatetime), "dd/MM/yyyy HH:mm", { locale: pt })} – {format(new Date(r.endDatetime), "HH:mm")} · {r.totalHours.toFixed(1)}h
                    </p>
                    {r.customRequest && <p className="text-xs text-amber-300 mt-1">{r.customRequest}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approveReservation(r.id)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20">
                      Aprovar
                    </button>
                    <button onClick={() => rejectReservation(r.id)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                      Rejeitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA]">
            <option value="ALL">Todos os estados</option>
            <option value="CONFIRMADA">Confirmada</option>
            <option value="RESERVADO">Reservado</option>
            <option value="CANCELADA">Cancelada</option>
            <option value="PENDENTE_APROVACAO">Pend. Aprovação</option>
          </select>
          <select value={filterPayStatus} onChange={e => setFilterPayStatus(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA]">
            <option value="ALL">Pagamento (todos)</option>
            <option value="PAGO">Pago</option>
            <option value="PENDENTE">Pendente</option>
            <option value="FACTURADO">Facturado</option>
            <option value="ISENTO">Isento</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#94A3B8]">De</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA]" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#94A3B8]">Até</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA]" />
          </div>
          <button onClick={() => { setFilterStatus("ALL"); setFilterPayStatus("ALL"); setFilterDateFrom(""); setFilterDateTo(""); }}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#94A3B8] hover:bg-white/5">
            Limpar
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[#94A3B8]">
              <tr>
                <th className="px-4 py-3 font-medium">Nº</th>
                <th className="px-4 py-3 font-medium">Evento</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Início</th>
                <th className="px-4 py-3 font-medium">h</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Pagamento</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-[#94A3B8]">A carregar...</td></tr>
              )}
              {!loading && reservations.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-[#94A3B8]">Sem reservas encontradas.</td></tr>
              )}
              {reservations.map(r => {
                const planName  = r.plan?.name || "—";
                const planCls   = PLAN_COLORS[planName] || "bg-white/10 text-[#94A3B8]";
                const resSt     = RES_STATUS[r.status]  || { label: r.status, cls: "bg-white/10 text-[#94A3B8]" };
                const paySt     = PAY_STATUS[r.paymentStatus] || { label: r.paymentStatus, cls: "bg-white/10 text-[#94A3B8]" };
                const isExpanded = expandedRow === r.id;

                return (
                  <>
                    <tr key={r.id} className="text-[#F5F7FA] hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => setExpandedRow(isExpanded ? null : r.id)}>
                      <td className="px-4 py-3 font-mono text-xs text-[#94A3B8]">
                        {r.reservationNumber || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium">{r.eventName}</td>
                      <td className="px-4 py-3 text-[#94A3B8] text-xs">
                        {r.company?.name || r.companyName || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${planCls}`}>{planName}</span>
                      </td>
                      <td className="px-4 py-3 text-[#94A3B8] text-xs">
                        {format(new Date(r.startDatetime), "dd/MM/yyyy")}
                      </td>
                      <td className="px-4 py-3 text-[#94A3B8] text-xs">
                        {format(new Date(r.startDatetime), "HH:mm")} – {format(new Date(r.endDatetime), "HH:mm")}
                      </td>
                      <td className="px-4 py-3 text-[#94A3B8] text-xs">{r.totalHours.toFixed(1)}h</td>
                      <td className="px-4 py-3 font-semibold text-[#5C8FFF] text-xs">
                        {r.totalAmount > 0 ? formatKz(r.totalAmount) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${resSt.cls}`}>{resSt.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${paySt.cls}`}>{paySt.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          {r.paymentStatus === "PENDENTE" && r.status !== "CANCELADA" && (
                            <button onClick={() => setReceivingPayment(r)}
                              className="rounded-lg bg-emerald-600/80 px-2.5 py-1 text-xs text-white hover:bg-emerald-600">
                              💰 Receber
                            </button>
                          )}
                          <button onClick={() => setEditingRes(r)}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs hover:bg-white/5">
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr key={`${r.id}-expanded`} className="bg-white/[0.01]">
                        <td colSpan={11} className="px-6 py-4">
                          <div className="grid grid-cols-3 gap-4 text-xs text-[#94A3B8]">
                            <div>
                              <p className="font-semibold text-[#F5F7FA] mb-2">Contacto</p>
                              <p>👤 {r.responsible}</p>
                              {r.email    && <p>📧 {r.email}</p>}
                              {r.whatsapp && <p>📱 {r.whatsapp}</p>}
                            </div>
                            <div>
                              <p className="font-semibold text-[#F5F7FA] mb-2">Financeiro</p>
                              <p>Opção: {r.paymentOption}</p>
                              {r.paymentMethod && <p>Método: {r.paymentMethod}</p>}
                              {r.operationRef  && <p>Ref: {r.operationRef}</p>}
                              {r.discount > 0  && <p>Desconto: {formatKz(r.discount)}</p>}
                              {r.iva > 0       && <p>IVA: {r.iva}%</p>}
                            </div>
                            <div>
                              <p className="font-semibold text-[#F5F7FA] mb-2">Documentos</p>
                              {r.paymentId  && <p>Pagamento: <span className="text-[#5C8FFF]">registado</span></p>}
                              {r.invoiceId  && <p>Factura: <span className="text-[#5C8FFF]">emitida</span></p>}
                              {r.receiptUrl && (
                                <a href={r.receiptUrl} target="_blank" rel="noreferrer"
                                  className="text-[#5C8FFF] hover:underline">📎 Ver comprovativo</a>
                              )}
                              {r.observations && <p className="mt-1 text-[#94A3B8]">Obs: {r.observations}</p>}
                              {r.coffeeBreak  && <p>☕ Coffee Break incluído</p>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Plans section */}
        <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Planos Disponíveis</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {plans.map(plan => {
            const cls = PLAN_COLORS[plan.name] || "bg-white/10 text-[#94A3B8]";
            return (
              <div key={plan.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{plan.name}</span>
                  {plan.coffeeBreakAvailable && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">☕</span>
                  )}
                </div>
                <p className="text-xs text-[#94A3B8]">Até {plan.maxPeople} pessoas</p>
                {plan.pricePerHour > 0 && (
                  <p className="text-sm font-bold text-[#5C8FFF] mt-1">{formatKz(plan.pricePerHour)}<span className="text-xs font-normal text-[#94A3B8]">/hora</span></p>
                )}
                {plan.coffeeBreakPrice > 0 && (
                  <p className="text-xs text-amber-300 mt-0.5">☕ +{formatKz(plan.coffeeBreakPrice)}</p>
                )}
                {plan.description && <p className="mt-2 text-[11px] text-[#94A3B8] line-clamp-3">{plan.description}</p>}
              </div>
            );
          })}
        </div>

      </main>

      {editingRes && (
        <ReservationModal reservation={editingRes} plans={plans}
          onClose={() => setEditingRes(null)} onSaved={fetchAll} />
      )}
      {creatingRes && (
        <ReservationModal plans={plans}
          onClose={() => setCreatingRes(false)} onSaved={fetchAll} />
      )}
      {receivingPayment && (
        <ReceivePaymentModal reservation={receivingPayment}
          onClose={() => setReceivingPayment(null)} onSaved={fetchAll} />
      )}
    </div>
  );
}
