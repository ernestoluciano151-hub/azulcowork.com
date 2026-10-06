"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import EmployeesPanel from "@/components/admin/EmployeesPanel";
import GenerateDocModal from "@/components/admin/GenerateDocModal";
import { formatKz } from "@/lib/currency";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Link from "next/link";

const TIMELINE_ICONS: Record<string, string> = {
  LEAD_CRIADO:       "👤",
  LEAD_CONTACTADO:   "📞",
  LEAD_CONVERTIDO:   "🏢",
  RESERVA_CRIADA:    "📅",
  RESERVA_CONFIRMADA:"✅",
  RESERVA_CANCELADA: "❌",
  PAGAMENTO_RECEBIDO:"💰",
  PAGAMENTO_PENDENTE:"⏳",
  FACTURA_EMITIDA:   "🧾",
  CONTRATO_CRIADO:   "📄",
  NOTA:              "📝",
  DOCUMENTO:         "📎",
};

type TimelineEntry = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  amount: number | null;
  createdBy: string | null;
  createdAt: string;
};

type RoomLead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  planName: string;
  status: string;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  PAGO:             "bg-emerald-500/15 text-emerald-300",
  PAGO_PARCIALMENTE:"bg-blue-500/15 text-blue-300",
  LIQUIDADO:        "bg-emerald-500/15 text-emerald-300",
  PENDENTE:         "bg-amber-500/15 text-amber-300",
  EM_ATRASO:        "bg-red-500/15 text-red-300",
  ATRASADO:         "bg-red-500/15 text-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  LIQUIDADO:        "✅ LIQUIDADO",
  PAGO_PARCIALMENTE:"⚠️ PAGO PARCIALMENTE",
  EM_ATRASO:        "🔴 EM ATRASO",
  PENDENTE:         "🕐 PENDENTE",
};

type FinanceSummary = {
  months: number;
  totalContracted: number;
  totalPaid: number;
  balance: number;
  financialStatus: string;
  creditAmount: number;
  prepaidMonths: number;
  monthsCovered: number;
  paidThrough: string;
  company: {
    id: string; name: string; nif: string | null; email: string;
    whatsapp: string; responsible: string; roomNumber: string;
    planType: string; rentAmount: number; paymentFrequency: string;
    contractStart: string; contractEnd: string; contractStatus: string;
    payments: Payment[];
    financialHistory: HistoryEntry[];
  };
};

type Payment = {
  id: string; amount: number; status: string;
  dueDate: string; paidDate: string | null;
  paymentMethod: string | null; notes: string | null;
};

type HistoryEntry = {
  id: string; type: string; description: string;
  amount: number; runningBalance: number;
  method: string | null; createdBy: string | null; createdAt: string;
};

export default function CompanyFinancePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData]             = useState<FinanceSummary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  // data local (Luanda UTC+1) — toISOString() devolveria o dia anterior entre 00h e 01h
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const emptyForm = { amount: "", paymentMethod: "Transferência Bancária", notes: "", dueDate: todayIso, paidDate: todayIso };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [roomLeads, setRoomLeads] = useState<RoomLead[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [finRes, tlRes, leadsRes] = await Promise.all([
      fetch(`/api/finance/company/${id}`),
      fetch(`/api/timeline?companyId=${id}`),
      fetch(`/api/room-booking-leads?companyId=${id}&pageSize=50`),
    ]);
    if (finRes.ok) setData(await finRes.json());
    if (tlRes.ok) { const d = await tlRes.json(); setTimeline(d.timeline || []); }
    if (leadsRes.ok) { const d = await leadsRes.json(); setRoomLeads(d.leads || []); }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // Abre o modal com valores sugeridos. Se o contrato já está liquidado (ou
  // pago à frente), sugere a renda do PRÓXIMO período não coberto — pagamento
  // antecipado — com o vencimento nessa data futura.
  function openPaymentModal() {
    if (data) {
      const { balance: bal, company: co, paidThrough } = data;
      const advance = bal <= 0;
      setForm({
        ...emptyForm,
        amount:  advance ? String(co.rentAmount) : String(Math.round(bal * 100) / 100),
        dueDate: advance ? format(new Date(paidThrough), "yyyy-MM-dd") : todayIso,
      });
    }
    setShowModal(true);
  }

  async function addPayment() {
    const amountNum = Number(form.amount);
    if (!form.amount || !(amountNum > 0)) { showToast("Indique um valor válido.", false); return; }
    if (form.paidDate > todayIso) { showToast("A data do pagamento não pode ser futura — use o vencimento para o período futuro.", false); return; }
    setSaving(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: id,
        amount: amountNum,
        dueDate: form.dueDate,
        paidDate: form.paidDate,
        paymentMethod: form.paymentMethod,
        notes: form.notes,
        status: "PAGO",
      }),
    });
    setSaving(false);
    if (res.ok) {
      showToast("Pagamento registado com sucesso.", true);
      setShowModal(false);
      setForm(emptyForm);
      fetchData();
    } else {
      const d = await res.json().catch(() => ({}));
      showToast(d.error || "Erro ao registar pagamento.", false);
    }
  }

  if (loading) return (
    <AdminLayout>
        <p className="text-[#94A3B8]">A carregar...</p>
  </AdminLayout>
  );

  if (!data) return (
    <AdminLayout>
        <p className="text-red-400">Empresa não encontrada.</p>
  </AdminLayout>
  );

  const { company, months, totalContracted, totalPaid, balance, financialStatus, creditAmount, prepaidMonths, paidThrough } = data;
  const pct = totalContracted > 0 ? Math.min(100, (totalPaid / totalContracted) * 100) : 0;
  const isPrepaid = creditAmount > 0.01 && prepaidMonths > 0;
  const paidThroughLabel = format(new Date(paidThrough), "dd/MM/yyyy");

  return (
    <AdminLayout>

        {/* Toast */}
        {toast && (
          <div className={`fixed right-6 top-6 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="text-[#94A3B8] hover:text-[#F5F7FA] text-sm">← Voltar</button>
              <span className="text-[#94A3B8]">/</span>
              <Link href="/admin/pagamentos" className="text-[#94A3B8] hover:text-[#5C8FFF] text-sm">Pagamentos</Link>
            </div>
            <h1 className="font-display text-2xl font-bold text-[#F5F7FA] mt-2">{company.name}</h1>
            <p className="text-sm text-[#94A3B8]">{company.planType} · Sala {company.roomNumber} · {company.responsible}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowDocModal(true)}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
            >
              📃 Gerar Contrato
            </button>
            <button
              onClick={openPaymentModal}
              className="rounded-xl bg-[#2F6FED] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E4FB8] transition-colors"
            >
              + Registar Pagamento
            </button>
          </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#2F6FED]/20 bg-[#2F6FED]/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5C8FFF]">Valor Contratado</p>
            <p className="mt-2 text-2xl font-bold text-[#5C8FFF]">{formatKz(totalContracted)}</p>
            <p className="mt-1 text-xs text-[#94A3B8]">{months} mês{months !== 1 ? "es" : ""} × {formatKz(company.rentAmount)}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Total Recebido</p>
            <p className="mt-2 text-2xl font-bold text-emerald-300">{formatKz(totalPaid)}</p>
            <p className="mt-1 text-xs text-[#94A3B8]">{pct.toFixed(0)}% do contrato</p>
          </div>
          <div className={`rounded-xl border p-5 ${balance <= 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${balance <= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {balance > 0 ? "Saldo em Dívida" : creditAmount > 0.01 ? "Crédito (pago à frente)" : "Liquidado"}
            </p>
            <p className={`mt-2 text-2xl font-bold ${balance <= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {formatKz(balance > 0 ? balance : creditAmount)}
            </p>
            {balance <= 0 && (
              <p className="mt-1 text-xs text-[#94A3B8]">Renda paga até {paidThroughLabel}</p>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Estado Financeiro</p>
            <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLORS[financialStatus] || "bg-white/10 text-[#94A3B8]"}`}>
              {isPrepaid ? `✅ LIQUIDADO · +${prepaidMonths} mês(es) antecipado(s)` : (STATUS_LABELS[financialStatus] || financialStatus)}
            </span>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex justify-between text-xs text-[#94A3B8] mb-2">
            <span>Progresso do Pagamento</span>
            <span>{pct.toFixed(1)}%</span>
          </div>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct > 50 ? "bg-[#2F6FED]" : "bg-amber-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[#94A3B8] mt-2">
            <span>Período: {format(new Date(company.contractStart), "dd/MM/yyyy")} – {format(new Date(company.contractEnd), "dd/MM/yyyy")}</span>
            <span>{months} meses</span>
          </div>
        </div>

        {/* Historial de Pagamentos */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="font-semibold text-[#F5F7FA]">Pagamentos Registados</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                <tr>
                  <th className="px-5 py-3">Data Pagamento</th>
                  <th className="px-5 py-3">Valor Pago</th>
                  <th className="px-5 py-3">Método</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {company.payments.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-6 text-center text-[#94A3B8]">Nenhum pagamento registado.</td></tr>
                )}
                {company.payments.map((p) => (
                  <tr key={p.id} className="text-[#F5F7FA] hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-[#94A3B8]">
                      {p.paidDate
                        ? format(new Date(p.paidDate), "dd/MM/yyyy", { locale: pt })
                        : format(new Date(p.dueDate), "dd/MM/yyyy", { locale: pt })}
                    </td>
                    <td className="px-5 py-3 font-semibold">{formatKz(p.amount)}</td>
                    <td className="px-5 py-3 text-[#94A3B8]">{p.paymentMethod || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || "bg-white/10 text-[#94A3B8]"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#94A3B8]">{p.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Histórico Financeiro */}
        {company.financialHistory.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="font-semibold text-[#F5F7FA]">Histórico Financeiro</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  <tr>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Descrição</th>
                    <th className="px-5 py-3">Valor</th>
                    <th className="px-5 py-3">Saldo Acumulado</th>
                    <th className="px-5 py-3">Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {company.financialHistory.map((h) => (
                    <tr key={h.id} className="text-[#F5F7FA] hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-[#94A3B8] whitespace-nowrap">
                        {format(new Date(h.createdAt), "dd/MM/yyyy HH:mm")}
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-[#2F6FED]/15 px-2 py-0.5 text-xs text-[#5C8FFF]">{h.type}</span>
                      </td>
                      <td className="px-5 py-3 text-[#94A3B8]">{h.description}</td>
                      <td className="px-5 py-3 font-semibold text-emerald-300">{formatKz(h.amount)}</td>
                      <td className={`px-5 py-3 font-semibold ${h.runningBalance >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {formatKz(Math.abs(h.runningBalance))}
                        {h.runningBalance < 0 ? " em dívida" : " em crédito"}
                      </td>
                      <td className="px-5 py-3 text-[#94A3B8]">{h.createdBy || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Colaboradores */}
        <EmployeesPanel companyId={data.company.id} />

        {/* Timeline CRM */}
        {(timeline.length > 0 || roomLeads.length > 0) && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="font-semibold text-[#F5F7FA]">Timeline CRM</h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Room Booking Leads linked */}
              {roomLeads.length > 0 && (
                <div className="mb-4 rounded-lg border border-[#2F6FED]/20 bg-[#2F6FED]/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#5C8FFF] mb-3">Leads de Sala Associados</p>
                  <div className="space-y-2">
                    {roomLeads.map(l => (
                      <div key={l.id} className="flex items-center justify-between text-sm">
                        <span className="text-[#F5F7FA]">👤 {l.firstName} {l.lastName}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[#94A3B8] text-xs">{l.planName}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            l.status === "CONVERTIDO" ? "bg-emerald-500/15 text-emerald-300" :
                            l.status === "RESERVA_CRIADA" ? "bg-blue-500/15 text-blue-300" :
                            "bg-white/10 text-[#94A3B8]"
                          }`}>{l.status}</span>
                          <span className="text-[#94A3B8] text-xs">{format(new Date(l.createdAt), "dd/MM/yyyy")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Timeline entries */}
              <div className="relative pl-6 space-y-0">
                {/* Vertical line */}
                {timeline.length > 1 && (
                  <div className="absolute left-2.5 top-2 bottom-2 w-px bg-white/10" />
                )}
                {timeline.map((entry) => (
                  <div key={entry.id} className="relative pb-5 last:pb-0">
                    {/* Dot */}
                    <div className="absolute -left-6 top-0 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-[#0d1829] text-sm">
                      {TIMELINE_ICONS[entry.type] || "•"}
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-[#F5F7FA]">{entry.title}</p>
                          {entry.description && (
                            <p className="mt-0.5 text-xs text-[#94A3B8]">{entry.description}</p>
                          )}
                          {entry.amount != null && (
                            <p className="mt-1 text-xs font-semibold text-emerald-300">{formatKz(entry.amount)}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-[#94A3B8]">{format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm")}</p>
                          {entry.createdBy && <p className="text-xs text-[#94A3B8]/70">{entry.createdBy}</p>}
                        </div>
                      </div>
                      <div className="mt-1.5">
                        <span className="rounded-full bg-[#2F6FED]/10 px-2 py-0.5 text-[10px] font-semibold text-[#5C8FFF]">{entry.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal — Registar Pagamento */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#101a2e] p-6 shadow-2xl">
              <h2 className="mb-1 text-lg font-bold text-[#F5F7FA]">Registar Pagamento</h2>
              <p className="mb-5 text-sm text-[#94A3B8]">{company.name}</p>

              {/* Contexto do contrato */}
              <div className="mb-5 rounded-xl bg-[#2F6FED]/10 border border-[#2F6FED]/20 p-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Valor total contratado</span>
                  <span className="font-bold text-[#5C8FFF]">{formatKz(totalContracted)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Já recebido</span>
                  <span className="font-bold text-emerald-300">{formatKz(totalPaid)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1">
                  <span className="text-[#94A3B8]">Saldo em falta</span>
                  <span className={`font-bold ${balance > 0 ? "text-red-300" : "text-emerald-300"}`}>{formatKz(Math.abs(balance))}</span>
                </div>
                {balance <= 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Renda paga até</span>
                    <span className="font-bold text-emerald-300">{paidThroughLabel}</span>
                  </div>
                )}
                {form.amount && Number(form.amount) > 0 && (
                  <div className="flex justify-between border-t border-white/10 pt-1">
                    <span className="text-[#94A3B8]">
                      {balance - Number(form.amount) < -0.01 ? "Crédito após este pagamento" : "Saldo após este pagamento"}
                    </span>
                    <span className={`font-bold ${balance - Number(form.amount) > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                      {formatKz(Math.abs(balance - Number(form.amount)))}
                      {balance - Number(form.amount) > 0 ? " em dívida" : balance - Number(form.amount) < -0.01 ? " ✅ pago à frente" : " ✅ LIQUIDADO"}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Valor Pago (AOA) *</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder={formatKz(company.rentAmount)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none"
                  />
                  {company.rentAmount > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[1, 2, 3, 6].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setForm({ ...form, amount: String(Math.round(company.rentAmount * n * 100) / 100) })}
                          className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#94A3B8] hover:bg-white/5"
                        >
                          {n} mês{n > 1 ? "es" : ""} ({formatKz(company.rentAmount * n)})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1">Data do Pagamento (recebido)</label>
                    <input
                      type="date"
                      value={form.paidDate}
                      max={todayIso}
                      onChange={(e) => setForm({ ...form, paidDate: e.target.value })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1">Período / Vencimento (pode ser futuro)</label>
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1">Método</label>
                    <select
                      value={form.paymentMethod}
                      onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none"
                    >
                      {["Transferência Bancária","Multicaixa","Numerário","TPA","Cheque","Outro"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1">Observações</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none resize-none"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  onClick={addPayment}
                  disabled={saving || !form.amount}
                  className="rounded-lg bg-[#2F6FED] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E4FB8] disabled:opacity-50"
                >
                  {saving ? "A guardar..." : "Registar Pagamento"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal geração de contrato (VOL08) */}
        {data && (
          <GenerateDocModal
            isOpen={showDocModal}
            onClose={() => setShowDocModal(false)}
            entityType="COMPANY"
            entityId={id}
            entityName={data.company.name}
            defaultSlug="contrato-coworking"
            prefillVars={{
              nomeEmpresa:      data.company.name,
              nifEmpresa:       data.company.nif ?? "",
              planoDescricao:   data.company.planType,
              valorMensal:      formatKz(data.company.rentAmount),
              dataInicio:       data.company.contractStart
                                  ? format(new Date(data.company.contractStart), "dd/MM/yyyy", { locale: pt })
                                  : "",
              dataFim:          data.company.contractEnd
                                  ? format(new Date(data.company.contractEnd), "dd/MM/yyyy", { locale: pt })
                                  : "",
              dataDocumento:    format(new Date(), "dd/MM/yyyy", { locale: pt }),
              emailContacto:    data.company.email,
            }}
          />
        )}
    </AdminLayout>
  );
}
