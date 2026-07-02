"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import { formatKz } from "@/lib/currency";
import { format } from "date-fns";
import DeleteRequestModal from "@/components/admin/DeleteRequestModal";
import FinanceDashboard from "@/components/finance/FinanceDashboard";

const STATUS_COLORS: Record<string, string> = {
  PAGO: "bg-emerald-500/15 text-emerald-300",
  PENDENTE: "bg-amber-500/15 text-amber-300",
  ATRASADO: "bg-red-500/15 text-red-300",
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  PAGO: "bg-emerald-500/15 text-emerald-300",
  PENDENTE: "bg-amber-500/15 text-amber-300",
  CANCELADO: "bg-red-500/15 text-red-300",
};

const EXPENSE_CATEGORIES = [
  "Internet", "Energia", "Água", "Limpeza", "Manutenção",
  "Salários", "Marketing", "Outros",
];

const PAYMENT_METHODS = [
  "Transferência Bancária", "Multicaixa", "Numerário", "TPA", "Cheque", "Outro",
];

type Payment = {
  id: string;
  companyId: string;
  company: { id: string; name: string };
  dueDate: string;
  paidDate: string | null;
  amount: number;
  status: string;
  notes: string | null;
  paymentMethod?: string | null;
  receiptUrl?: string | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  companyId: string;
  company: { id: string; name: string };
  serviceType: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  paymentMethod?: string | null;
  status: string;
  receiptUrl?: string | null;
  notes?: string | null;
};

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  supplier?: string | null;
  status: string;
  receiptUrl?: string | null;
  notes?: string | null;
};

type Company = { id: string; name: string };

const TABS = ["Dashboard", "Pagamentos", "Faturas", "Despesas", "Relatórios"] as const;
type Tab = (typeof TABS)[number];

export default function PagamentosPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");

  // Auth check — qualquer utilizador autenticado tem acesso (ADMIN e USER)
  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!d) router.push("/admin/login"); })
      .catch(() => router.push("/admin/login"));
  }, [router]);

  return (
    <div className="flex min-h-screen bg-[#0B1220]">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#F5F7FA]">
              Módulo Financeiro ERP
            </h1>
            <p className="mt-1 text-sm text-[#94A3B8]">Gestão completa de receitas, faturas, despesas e fluxo de caixa</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-[#2F6FED] text-white shadow"
                  : "text-[#94A3B8] hover:text-[#F5F7FA]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Dashboard" && <DashboardTab />}
        {activeTab === "Pagamentos" && <PagamentosTab />}
        {activeTab === "Faturas" && <FaturasTab />}
        {activeTab === "Despesas" && <DespesasTab />}
        {activeTab === "Relatórios" && <RelatoriosTab />}
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────
   TAB 1 — Dashboard Financeiro
───────────────────────────────────────── */
function DashboardTab() {
  return <FinanceDashboard />;
}

/* ─────────────────────────────────────────
   TAB 2 — Pagamentos
───────────────────────────────────────── */
function PagamentosTab() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState({ pago: 0, pendente: 0, atrasado: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [month, setMonth] = useState("");
  const [q, setQ] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; label: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);

  // New payment form
  const [form, setForm] = useState({
    companyId: "", amount: "", dueDate: "", paymentMethod: "", notes: "", status: "PENDENTE",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies || []));
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (month) params.set("month", month);
    if (q) params.set("q", q);
    const res = await fetch(`/api/payments?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setPayments(data.payments);
      setSummary(data.summary);
    }
    setLoading(false);
  }, [statusFilter, month, q]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  async function markAsPago(payment: Payment, method?: string) {
    setMarkingId(payment.id);
    await fetch(`/api/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "PAGO",
        paidDate: new Date().toISOString(),
        paymentMethod: method || null,
      }),
    });
    setMarkingId(null);
    fetchPayments();
  }

  async function savePayment() {
    setSaving(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setShowModal(false);
      setForm({ companyId: "", amount: "", dueDate: "", paymentMethod: "", notes: "", status: "PENDENTE" });
      fetchPayments();
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por empresa..."
            className="min-w-[180px] rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
          >
            <option value="ALL">Todos</option>
            <option value="PAGO">Pago</option>
            <option value="PENDENTE">Pendente</option>
            <option value="ATRASADO">Atrasado</option>
          </select>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-[#2F6FED] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E4FB8] transition-colors"
        >
          + Adicionar Pagamento
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Total recebido</p>
          <p className="mt-1 text-xl font-bold text-emerald-300">{formatKz(summary.pago)}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Total pendente</p>
          <p className="mt-1 text-xl font-bold text-amber-300">{formatKz(summary.pendente)}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Total em atraso</p>
          <p className="mt-1 text-xl font-bold text-red-300">{formatKz(summary.atrasado)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-[#94A3B8]">
            <tr>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Data Pagamento</th>
              <th className="px-4 py-3 font-medium">Método</th>
              <th className="px-4 py-3 font-medium">Comprovativo</th>
              <th className="px-4 py-3 font-medium">Acções</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[#94A3B8]">A carregar...</td></tr>
            )}
            {!loading && payments.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[#94A3B8]">Nenhum pagamento encontrado.</td></tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="text-[#F5F7FA] hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium">{p.company.name}</td>
                <td className="px-4 py-3 text-[#94A3B8]">{format(new Date(p.dueDate), "dd/MM/yyyy")}</td>
                <td className="px-4 py-3">{formatKz(p.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || "bg-white/10 text-[#94A3B8]"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#94A3B8]">
                  {p.paidDate ? format(new Date(p.paidDate), "dd/MM/yyyy") : "—"}
                </td>
                <td className="px-4 py-3 text-[#94A3B8] text-xs">{p.paymentMethod || "—"}</td>
                <td className="px-4 py-3">
                  {p.receiptUrl ? (
                    <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-[#2F6FED] hover:underline">Ver</a>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {(p.status === "PENDENTE" || p.status === "ATRASADO") && (
                      <button
                        onClick={() => markAsPago(p)}
                        disabled={markingId === p.id}
                        className="rounded-lg bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                      >
                        {markingId === p.id ? "..." : "Marcar Pago"}
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteModal({ id: p.id, label: `Pagamento ${p.company.name} — ${format(new Date(p.dueDate), "MM/yyyy")}` })}
                      className="rounded-lg border border-red-500/20 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Payment Modal */}
      {showModal && (
        <Modal title="Novo Pagamento" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]">Empresa *</label>
              <select
                value={form.companyId}
                onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
              >
                <option value="">Seleccionar empresa...</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Valor (AOA) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Vencimento *</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Método de Pagamento</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                >
                  <option value="">Seleccionar...</option>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="PAGO">Pago</option>
                  <option value="ATRASADO">Atrasado</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]">Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:text-[#F5F7FA]">
                Cancelar
              </button>
              <button
                onClick={savePayment}
                disabled={saving}
                className="rounded-lg bg-[#2F6FED] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E4FB8] disabled:opacity-50"
              >
                {saving ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteModal && (
        <DeleteRequestModal
          isOpen={true}
          onClose={() => setDeleteModal(null)}
          entityType="payment"
          entityId={deleteModal.id}
          entityLabel={deleteModal.label}
          onSuccess={() => { setDeleteModal(null); fetchPayments(); }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   TAB 3 — Faturas
───────────────────────────────────────── */
function FaturasTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [month, setMonth] = useState("");
  const [q, setQ] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const categories = [
    "Escritórios Privados", "Salas de Reunião", "Salas de Formação",
    "Cowork Diário", "Eventos", "Serviços Adicionais",
  ];

  const [form, setForm] = useState({
    companyId: "", serviceType: "", amount: "", issueDate: "", dueDate: "",
    paymentMethod: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies || []));
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (month) params.set("month", month);
    if (q) params.set("q", q);
    const res = await fetch(`/api/invoices?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setInvoices(data.invoices);
    }
    setLoading(false);
  }, [statusFilter, month, q]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  async function saveInvoice() {
    setSaving(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setShowModal(false);
      setForm({ companyId: "", serviceType: "", amount: "", issueDate: "", dueDate: "", paymentMethod: "", notes: "" });
      fetchInvoices();
    }
  }

  async function updateInvoiceStatus(id: string, status: string) {
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchInvoices();
  }

  async function deleteInvoice(id: string) {
    if (!confirm("Eliminar fatura?")) return;
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    fetchInvoices();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar empresa..."
            className="min-w-[160px] rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
          >
            <option value="ALL">Todos</option>
            <option value="PENDENTE">Pendente</option>
            <option value="PAGO">Pago</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-[#2F6FED] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E4FB8] transition-colors"
        >
          + Nova Fatura
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-[#94A3B8]">
            <tr>
              <th className="px-4 py-3 font-medium">Nº Fatura</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Serviço</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Emissão</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Método</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Comprovativo</th>
              <th className="px-4 py-3 font-medium">Acções</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-[#94A3B8]">A carregar...</td></tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-[#94A3B8]">Nenhuma fatura encontrada.</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="text-[#F5F7FA] hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-mono text-xs text-[#5C8FFF]">{inv.invoiceNumber}</td>
                <td className="px-4 py-3 font-medium">{inv.company.name}</td>
                <td className="px-4 py-3 text-[#94A3B8]">{inv.serviceType}</td>
                <td className="px-4 py-3">{formatKz(inv.amount)}</td>
                <td className="px-4 py-3 text-[#94A3B8]">{format(new Date(inv.issueDate), "dd/MM/yyyy")}</td>
                <td className="px-4 py-3 text-[#94A3B8]">{format(new Date(inv.dueDate), "dd/MM/yyyy")}</td>
                <td className="px-4 py-3 text-xs text-[#94A3B8]">{inv.paymentMethod || "—"}</td>
                <td className="px-4 py-3">
                  <select
                    value={inv.status}
                    onChange={(e) => updateInvoiceStatus(inv.id, e.target.value)}
                    className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#2F6FED] ${INVOICE_STATUS_COLORS[inv.status] || "bg-white/10 text-[#94A3B8]"}`}
                  >
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="PAGO">PAGO</option>
                    <option value="CANCELADO">CANCELADO</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    {inv.receiptUrl && (
                      <a href={inv.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-[#2F6FED] hover:underline">Ver</a>
                    )}
                    <a
                      href={`/api/invoices/${inv.id}/download`}
                      className="text-xs text-[#5C8FFF] hover:underline"
                      title="Baixar recibo em PDF"
                    >
                      download
                    </a>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => deleteInvoice(inv.id)}
                    className="rounded-lg border border-red-500/20 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Nova Fatura" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]">Empresa *</label>
              <select
                value={form.companyId}
                onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
              >
                <option value="">Seleccionar empresa...</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]">Serviço *</label>
              <select
                value={form.serviceType}
                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
              >
                <option value="">Seleccionar serviço...</option>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Valor (AOA) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Método de Pagamento</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                >
                  <option value="">Seleccionar...</option>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Data Emissão</label>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Data Vencimento *</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]">Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:text-[#F5F7FA]">
                Cancelar
              </button>
              <button
                onClick={saveInvoice}
                disabled={saving}
                className="rounded-lg bg-[#2F6FED] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E4FB8] disabled:opacity-50"
              >
                {saving ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   TAB 4 — Despesas
───────────────────────────────────────── */
function DespesasTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState({ totalMes: 0, totalAnual: 0 });
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [month, setMonth] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    category: "", description: "", amount: "", expenseDate: "",
    supplier: "", status: "PAGO", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryFilter !== "ALL") params.set("category", categoryFilter);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (month) params.set("month", month);
    const res = await fetch(`/api/expenses?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.expenses);
      setSummary(data.summary);
    }
    setLoading(false);
  }, [categoryFilter, statusFilter, month]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  async function saveExpense() {
    setSaving(true);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setShowModal(false);
      setForm({ category: "", description: "", amount: "", expenseDate: "", supplier: "", status: "PAGO", notes: "" });
      fetchExpenses();
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm("Eliminar despesa?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    fetchExpenses();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
          >
            <option value="ALL">Todas as categorias</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
          >
            <option value="ALL">Todos os estados</option>
            <option value="PAGO">Pago</option>
            <option value="PENDENTE">Pendente</option>
          </select>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-[#2F6FED] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E4FB8] transition-colors"
        >
          + Nova Despesa
        </button>
      </div>

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">Despesas do Mês</p>
          <p className="mt-1 text-xl font-bold text-orange-300">{formatKz(summary.totalMes)}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Despesas Anuais</p>
          <p className="mt-1 text-xl font-bold text-red-300">{formatKz(summary.totalAnual)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-[#94A3B8]">
            <tr>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">Fornecedor</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Notas</th>
              <th className="px-4 py-3 font-medium">Acções</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[#94A3B8]">A carregar...</td></tr>
            )}
            {!loading && expenses.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[#94A3B8]">Nenhuma despesa encontrada.</td></tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id} className="text-[#F5F7FA] hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[#2F6FED]/15 px-2.5 py-0.5 text-xs font-medium text-[#5C8FFF]">
                    {e.category}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[200px] truncate">{e.description}</td>
                <td className="px-4 py-3 text-[#94A3B8]">{e.supplier || "—"}</td>
                <td className="px-4 py-3 font-medium">{formatKz(e.amount)}</td>
                <td className="px-4 py-3 text-[#94A3B8]">{format(new Date(e.expenseDate), "dd/MM/yyyy")}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e.status === "PAGO" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[150px] truncate text-xs text-[#94A3B8]">{e.notes || "—"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => deleteExpense(e.id)}
                    className="rounded-lg border border-red-500/20 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Nova Despesa" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Categoria *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                >
                  <option value="">Seleccionar...</option>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                >
                  <option value="PAGO">Pago</option>
                  <option value="PENDENTE">Pendente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]">Descrição *</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Valor (AOA) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#94A3B8]">Data *</label>
                <input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]">Fornecedor</label>
              <input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]">Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:text-[#F5F7FA]">
                Cancelar
              </button>
              <button
                onClick={saveExpense}
                disabled={saving}
                className="rounded-lg bg-[#2F6FED] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E4FB8] disabled:opacity-50"
              >
                {saving ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   TAB 5 — Relatórios
───────────────────────────────────────── */
function RelatoriosTab() {
  const reports = [
    { type: "receita-mensal", label: "Receita Mensal", icon: "📅", desc: "Todos os pagamentos recebidos no mês atual" },
    { type: "receita-anual", label: "Receita Anual", icon: "📊", desc: "Resumo mensal de receitas do ano atual" },
    { type: "devedoras", label: "Empresas Devedoras", icon: "⚠️", desc: "Lista de empresas com pagamentos em atraso" },
    { type: "fluxo-caixa", label: "Fluxo de Caixa", icon: "💸", desc: "Receitas vs despesas mensais do ano" },
    { type: "despesas", label: "Despesas por Categoria", icon: "🧾", desc: "Todas as despesas do ano por categoria" },
  ];

  return (
    <div>
      <p className="mb-6 text-sm text-[#94A3B8]">
        Gere relatórios financeiros em formato Excel (.xlsx) para análise externa.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <a
            key={r.type}
            href={`/api/finance/report?type=${r.type}`}
            download
            className="group flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-[#2F6FED]/40 hover:bg-[#2F6FED]/5"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{r.icon}</span>
              <div>
                <p className="font-medium text-[#F5F7FA] group-hover:text-[#5C8FFF]">{r.label}</p>
                <p className="text-xs text-[#94A3B8]">.xlsx</p>
              </div>
            </div>
            <p className="text-xs text-[#94A3B8]">{r.desc}</p>
            <div className="mt-auto rounded-lg bg-[#2F6FED]/10 px-3 py-1.5 text-center text-xs font-medium text-[#5C8FFF] group-hover:bg-[#2F6FED]/20">
              Descarregar
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Shared Modal component
───────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#101a2e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-semibold text-[#F5F7FA]">{title}</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#F5F7FA]">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
