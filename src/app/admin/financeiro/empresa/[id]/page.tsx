"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import { formatKz } from "@/lib/currency";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Link from "next/link";

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
  const [data, setData]       = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ amount: "", paymentMethod: "Transferência Bancária", notes: "", dueDate: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/finance/company/${id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function addPayment() {
    if (!form.amount) return;
    setSaving(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: id,
        amount: Number(form.amount),
        dueDate: form.dueDate,
        paymentMethod: form.paymentMethod,
        notes: form.notes,
        status: "PAGO",
      }),
    });
    setSaving(false);
    if (res.ok) {
      showToast("Pagamento registado com sucesso.", true);
      setShowModal(false);
      setForm({ amount: "", paymentMethod: "Transferência Bancária", notes: "", dueDate: new Date().toISOString().split("T")[0] });
      fetchData();
    } else {
      showToast("Erro ao registar pagamento.", false);
    }
  }

  if (loading) return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8 flex items-center justify-center">
        <p className="text-[#94A3B8]">A carregar...</p>
      </main>
    </div>
  );

  if (!data) return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8 flex items-center justify-center">
        <p className="text-red-400">Empresa não encontrada.</p>
      </main>
    </div>
  );

  const { company, months, totalContracted, totalPaid, balance, financialStatus } = data;
  const pct = totalContracted > 0 ? Math.min(100, (totalPaid / totalContracted) * 100) : 0;

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8 space-y-6 overflow-y-auto">

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
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-[#2F6FED] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E4FB8] transition-colors"
          >
            + Registar Pagamento
          </button>
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
              {balance <= 0 ? "Liquidado" : "Saldo em Dívida"}
            </p>
            <p className={`mt-2 text-2xl font-bold ${balance <= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {formatKz(Math.abs(balance))}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Estado Financeiro</p>
            <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLORS[financialStatus] || "bg-white/10 text-[#94A3B8]"}`}>
              {STATUS_LABELS[financialStatus] || financialStatus}
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
                {form.amount && Number(form.amount) > 0 && (
                  <div className="flex justify-between border-t border-white/10 pt-1">
                    <span className="text-[#94A3B8]">Saldo após este pagamento</span>
                    <span className={`font-bold ${balance - Number(form.amount) > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                      {formatKz(Math.abs(balance - Number(form.amount)))}
                      {balance - Number(form.amount) <= 0 ? " ✅ LIQUIDADO" : " em dívida"}
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
                    placeholder={formatKz(balance)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1">Data do Pagamento</label>
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
      </main>
    </div>
  );
}
