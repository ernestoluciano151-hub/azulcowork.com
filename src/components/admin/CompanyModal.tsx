"use client";

import { useState } from "react";
import { format } from "date-fns";

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

export default function CompanyModal({ company, onClose, onSaved }: Props) {
  const isCreate = !company;

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
          notes: notes || null
        })
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
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-ink2 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-lg font-bold text-paper">
          {isCreate ? "Nova Empresa" : "Editar Empresa"}
        </h2>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
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

        <div className="mt-6 flex items-center justify-between">
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
      </div>
    </div>
  );
}

function FInput({
  label, value, onChange, type = "text"
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
