"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { formatKz } from "@/lib/currency";

const PLAN_TYPES = ["Hot Desk", "Sala Privada", "Sala Dedicada", "Virtual Office", "Outro"];
const CONTRACT_STATUSES = ["ATIVO", "PRESTES_EXPIRAR", "RENOVADO", "ENCERRADO"];
const PAYMENT_STATUSES = ["EM_DIA", "A_VENCER", "EM_ATRASO"];

export type Company = {
  id: string;
  name: string;
  nif?: string | null;
  responsible: string;
  email: string;
  whatsapp: string;
  roomNumber: string;
  numEmployees: number;
  planType: string;
  contractStart: string;
  contractEnd: string;
  rentAmount: number;
  contractStatus: string;
  paymentStatus: string;
  contractFileUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  company?: Company | null;
  onClose: () => void;
  onSaved: () => void;
};

type Payment = {
  id: string;
  dueDate: string;
  paidDate: string | null;
  amount: number;
  status: string;
  paymentMethod?: string | null;
  notes?: string | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  serviceType: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: string;
};

const STATUS_COLORS: Record<string, string> = {
  PAGO: "bg-emerald-500/15 text-emerald-300",
  PENDENTE: "bg-amber-500/15 text-amber-300",
  ATRASADO: "bg-red-500/15 text-red-300",
  CANCELADO: "bg-red-500/15 text-red-300",
};

type ModalTab = "dados" | "financeiro";

export default function CompanyModal({ company, onClose, onSaved }: Props) {
  const isCreate = !company;
  const [activeTab, setActiveTab] = useState<ModalTab>("dados");

  const [name, setName] = useState(company?.name ?? "");
  const [nif, setNif] = useState(company?.nif ?? "");
  const [responsible, setResponsible] = useState(company?.responsible ?? "");
  const [email, setEmail] = useState(company?.email ?? "");
  const [whatsapp, setWhatsapp] = useState(company?.whatsapp ?? "");
  const [roomNumber, setRoomNumber] = useState(company?.roomNumber ?? "");
  const [numEmployees, setNumEmployees] = useState(String(company?.numEmployees ?? "1"));
  const [planType, setPlanType] = useState(company?.planType ?? "Hot Desk");
  const [contractStart, setContractStart] = useState(
    company?.contractStart ? format(new Date(company.contractStart), "yyyy-MM-dd") : ""
  );
  const [contractEnd, setContractEnd] = useState(
    company?.contractEnd ? format(new Date(company.contractEnd), "yyyy-MM-dd") : ""
  );
  const [rentAmount, setRentAmount] = useState(String(company?.rentAmount ?? ""));
  const [contractStatus, setContractStatus] = useState(company?.contractStatus ?? "ATIVO");
  const [paymentStatus, setPaymentStatus] = useState(company?.paymentStatus ?? "EM_DIA");
  const [contractFileUrl, setContractFileUrl] = useState(company?.contractFileUrl ?? "");
  const [notes, setNotes] = useState(company?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!name || !responsible || !email || !whatsapp || !roomNumber || !planType || !contractStart || !contractEnd || !rentAmount) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const url = isCreate ? "/api/companies" : `/api/companies/${company!.id}`;
      const method = isCreate ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, nif: nif || null, responsible, email, whatsapp, roomNumber,
          numEmployees: Number(numEmployees),
          planType, contractStart, contractEnd,
          rentAmount: Number(rentAmount),
          contractStatus, paymentStatus,
          contractFileUrl: contractFileUrl || null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        setError(data.error || "Erro ao guardar.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/companies/${company!.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-ink2 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-0">
          <h2 className="font-display text-lg font-bold text-paper">
            {isCreate ? "Nova Empresa" : company!.name}
          </h2>

          {/* Tab bar (only for edit mode) */}
          {!isCreate && (
            <div className="mt-4 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <button
                onClick={() => setActiveTab("dados")}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "dados"
                    ? "bg-azul text-white"
                    : "text-mist hover:text-paper"
                }`}
              >
                Dados da Empresa
              </button>
              <button
                onClick={() => setActiveTab("financeiro")}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "financeiro"
                    ? "bg-azul text-white"
                    : "text-mist hover:text-paper"
                }`}
              >
                Histórico Financeiro
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {(isCreate || activeTab === "dados") && (
            <DadosTab
              {...{
                isCreate, name, setName, nif, setNif, responsible, setResponsible,
                email, setEmail, whatsapp, setWhatsapp, roomNumber, setRoomNumber,
                numEmployees, setNumEmployees, planType, setPlanType,
                contractStart, setContractStart, contractEnd, setContractEnd,
                rentAmount, setRentAmount, contractStatus, setContractStatus,
                paymentStatus, setPaymentStatus, contractFileUrl, setContractFileUrl,
                notes, setNotes, error,
              }}
            />
          )}

          {!isCreate && activeTab === "financeiro" && (
            <FinanceTab companyId={company!.id} />
          )}
        </div>

        {/* Footer (only for dados tab or create) */}
        {(isCreate || activeTab === "dados") && (
          <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
            {!isCreate && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="focus-ring rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                Eliminar empresa
              </button>
            )}
            {!isCreate && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-400">Confirmar eliminação?</span>
                <button
                  onClick={doDelete}
                  disabled={deleting}
                  className="focus-ring rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-60"
                >
                  {deleting ? "..." : "Sim, eliminar"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-sm text-mist hover:bg-white/5"
                >
                  Cancelar
                </button>
              </div>
            )}
            {isCreate && <div />}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="focus-ring rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-60"
              >
                {saving ? "A guardar..." : isCreate ? "Criar Empresa" : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {/* Close button for financeiro tab */}
        {!isCreate && activeTab === "financeiro" && (
          <div className="flex justify-end border-t border-white/10 px-6 py-4">
            <button
              onClick={onClose}
              className="focus-ring rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Dados Tab ── */
function DadosTab({
  isCreate, name, setName, nif, setNif, responsible, setResponsible,
  email, setEmail, whatsapp, setWhatsapp, roomNumber, setRoomNumber,
  numEmployees, setNumEmployees, planType, setPlanType,
  contractStart, setContractStart, contractEnd, setContractEnd,
  rentAmount, setRentAmount, contractStatus, setContractStatus,
  paymentStatus, setPaymentStatus, contractFileUrl, setContractFileUrl,
  notes, setNotes, error,
}: {
  isCreate: boolean;
  name: string; setName: (v: string) => void;
  nif: string; setNif: (v: string) => void;
  responsible: string; setResponsible: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  whatsapp: string; setWhatsapp: (v: string) => void;
  roomNumber: string; setRoomNumber: (v: string) => void;
  numEmployees: string; setNumEmployees: (v: string) => void;
  planType: string; setPlanType: (v: string) => void;
  contractStart: string; setContractStart: (v: string) => void;
  contractEnd: string; setContractEnd: (v: string) => void;
  rentAmount: string; setRentAmount: (v: string) => void;
  contractStatus: string; setContractStatus: (v: string) => void;
  paymentStatus: string; setPaymentStatus: (v: string) => void;
  contractFileUrl: string; setContractFileUrl: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  error: string;
}) {
  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FInput label="Nome da empresa *" value={name} onChange={setName} />
        <FInput label="NIF" value={nif} onChange={setNif} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <FInput label="Responsável *" value={responsible} onChange={setResponsible} />
        <FInput label="E-mail *" value={email} onChange={setEmail} type="email" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <FInput label="WhatsApp *" value={whatsapp} onChange={setWhatsapp} />
        <FInput label="Sala/Espaço *" value={roomNumber} onChange={setRoomNumber} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <FInput label="Nº Colaboradores" value={numEmployees} onChange={setNumEmployees} type="number" />
        <div>
          <label className="mb-1 block text-xs text-mist">Plano *</label>
          <select
            value={planType}
            onChange={(e) => setPlanType(e.target.value)}
            className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            {PLAN_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <FInput label="Renda Mensal (Kz) *" value={rentAmount} onChange={setRentAmount} type="number" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-mist">Início do contrato *</label>
          <input
            type="date"
            value={contractStart}
            onChange={(e) => setContractStart(e.target.value)}
            className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-mist">Fim do contrato *</label>
          <input
            type="date"
            value={contractEnd}
            onChange={(e) => setContractEnd(e.target.value)}
            className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-mist">Estado do Contrato</label>
          <select
            value={contractStatus}
            onChange={(e) => setContractStatus(e.target.value)}
            className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            {CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-mist">Estado de Pagamento</label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <FInput label="URL do contrato" value={contractFileUrl} onChange={setContractFileUrl} />
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs text-mist">Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          rows={3}
        />
      </div>
    </div>
  );
}

/* ── Finance Tab ── */
function FinanceTab({ companyId }: { companyId: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [pRes, iRes] = await Promise.all([
        fetch(`/api/payments?companyId=${companyId}`),
        fetch(`/api/invoices?companyId=${companyId}`),
      ]);
      if (pRes.ok) {
        const d = await pRes.json();
        setPayments(d.payments || []);
      }
      if (iRes.ok) {
        const d = await iRes.json();
        setInvoices(d.invoices || []);
      }
      setLoading(false);
    }
    load();
  }, [companyId]);

  if (loading) {
    return <div className="py-8 text-center text-mist">A carregar histórico...</div>;
  }

  const totalPago = payments.filter((p) => p.status === "PAGO").reduce((s, p) => s + p.amount, 0);
  const totalPendente = payments.filter((p) => p.status === "PENDENTE").reduce((s, p) => s + p.amount, 0);
  const totalAtrasado = payments.filter((p) => p.status === "ATRASADO").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
          <p className="text-xs text-emerald-400">Total Pago</p>
          <p className="mt-1 text-lg font-bold text-emerald-300">{formatKz(totalPago)}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
          <p className="text-xs text-amber-400">Pendente</p>
          <p className="mt-1 text-lg font-bold text-amber-300">{formatKz(totalPendente)}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
          <p className="text-xs text-red-400">Em Atraso</p>
          <p className="mt-1 text-lg font-bold text-red-300">{formatKz(totalAtrasado)}</p>
        </div>
      </div>

      {/* Payments table */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-paper">Pagamentos ({payments.length})</h3>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-ink2 text-mist">
              <tr>
                <th className="px-3 py-2 font-medium">Vencimento</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Pago em</th>
                <th className="px-3 py-2 font-medium">Método</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payments.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-mist">Sem pagamentos.</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="text-paper hover:bg-white/[0.02]">
                  <td className="px-3 py-2">{format(new Date(p.dueDate), "dd/MM/yyyy")}</td>
                  <td className="px-3 py-2 font-medium">{formatKz(p.amount)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || "bg-white/10 text-mist"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-mist">
                    {p.paidDate ? format(new Date(p.paidDate), "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="px-3 py-2 text-mist">{p.paymentMethod || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoices table */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-paper">Faturas ({invoices.length})</h3>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-ink2 text-mist">
              <tr>
                <th className="px-3 py-2 font-medium">Nº Fatura</th>
                <th className="px-3 py-2 font-medium">Serviço</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Emissão</th>
                <th className="px-3 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoices.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-mist">Sem faturas.</td></tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="text-paper hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-[#5C8FFF]">{inv.invoiceNumber}</td>
                  <td className="px-3 py-2 text-mist">{inv.serviceType}</td>
                  <td className="px-3 py-2 font-medium">{formatKz(inv.amount)}</td>
                  <td className="px-3 py-2 text-mist">{format(new Date(inv.issueDate), "dd/MM/yyyy")}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] || "bg-white/10 text-mist"}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FInput({
  label, value, onChange, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-mist">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
      />
    </div>
  );
}
