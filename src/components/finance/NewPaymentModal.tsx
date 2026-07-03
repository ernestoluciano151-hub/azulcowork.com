"use client";

import { useEffect, useState, useRef } from "react";
import { formatKz } from "@/lib/currency";

type Company = { id: string; name: string };

type ContractInfo = {
  totalContracted: number;
  totalPaid: number;
  balance: number;
  months: number;
  financialStatus: string;
};

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

const METHODS = [
  "Transferência Bancária", "Multicaixa", "Numerário", "TPA", "Cheque", "Outro",
];

const cloudinaryConfigured = () =>
  typeof window !== "undefined" &&
  (window as Window & { __CLOUDINARY__?: boolean }).__CLOUDINARY__ !== false;

export default function NewPaymentModal({ onClose, onSuccess }: Props) {
  const today = new Date().toISOString().split("T")[0];

  const [companies, setCompanies]       = useState<Company[]>([]);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [loadingContract, setLoadingContract] = useState(false);

  const [form, setForm] = useState({
    companyId:     "",
    amount:        "",
    dueDate:       today,
    paidDate:      today,
    paymentMethod: "Transferência Bancária",
    status:        "PAGO",
    notes:         "",
    operationRef:  "",
  });

  // files
  const [doc1, setDoc1] = useState<File | null>(null);
  const [doc2, setDoc2] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  const doc1Ref = useRef<HTMLInputElement>(null);
  const doc2Ref = useRef<HTMLInputElement>(null);

  // load companies
  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies || []));
  }, []);

  // load contract info when company changes
  useEffect(() => {
    if (!form.companyId) { setContractInfo(null); return; }
    setLoadingContract(true);
    fetch(`/api/finance/company/${form.companyId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setContractInfo({
            totalContracted: d.totalContracted,
            totalPaid:       d.totalPaid,
            balance:         d.balance,
            months:          d.months,
            financialStatus: d.financialStatus,
          });
          // pre-fill amount with outstanding balance
          if (d.balance > 0) setForm((f) => ({ ...f, amount: String(Math.round(d.balance)) }));
        }
        setLoadingContract(false);
      })
      .catch(() => setLoadingContract(false));
  }, [form.companyId]);

  const newPayment      = Number(form.amount) || 0;
  const balanceAfter    = contractInfo ? contractInfo.balance - newPayment : null;
  const pct             = contractInfo && contractInfo.totalContracted > 0
    ? Math.min(100, ((contractInfo.totalPaid + newPayment) / contractInfo.totalContracted) * 100)
    : 0;

  async function uploadFile(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "azul-cowork/pagamentos");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    const d = await res.json();
    return d.url || null;
  }

  async function handleSave() {
    if (!form.companyId) { setError("Seleccione uma empresa."); return; }
    if (!form.amount || newPayment <= 0) { setError("Indique o valor do pagamento."); return; }
    setError("");
    setSaving(true);

    let receiptUrl: string | null = null;
    let doc2Url:    string | null = null;

    if (doc1 || doc2) {
      setUploading(true);
      if (doc1) receiptUrl = await uploadFile(doc1);
      if (doc2) doc2Url   = await uploadFile(doc2);
      setUploading(false);
    }

    const res = await fetch("/api/payments", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId:     form.companyId,
        amount:        newPayment,
        dueDate:       form.dueDate,
        paidDate:      form.status === "PAGO" ? form.paidDate : null,
        paymentMethod: form.paymentMethod,
        status:        form.status,
        notes:         form.notes,
        operationRef:  form.operationRef,
        receiptUrl,
        doc2Url,
      }),
    });

    setSaving(false);
    if (res.ok) { onSuccess(); onClose(); }
    else { const d = await res.json(); setError(d.error || "Erro ao guardar."); }
  }

  const inp = "w-full rounded-lg border border-white/10 bg-[#0d1829] px-3 py-2.5 text-sm text-[#F5F7FA] focus:border-[#2F6FED] focus:outline-none placeholder:text-[#4b5a77]";
  const lbl = "block text-xs font-medium text-[#94A3B8] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1829] shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0d1829] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#F5F7FA]">Novo Pagamento</h2>
            <p className="text-xs text-[#94A3B8]">Preencha os dados — os cálculos são automáticos</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">

          {/* ── EMPRESA ── */}
          <div>
            <label className={lbl}>Empresa *</label>
            <select
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
              className={inp}
            >
              <option value="">Seleccionar empresa...</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* ── CONTEXTO DO CONTRATO ── */}
          {loadingContract && (
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 text-xs text-[#94A3B8]">
              A carregar dados do contrato...
            </div>
          )}

          {contractInfo && !loadingContract && (
            <div className="rounded-xl border border-[#2F6FED]/25 bg-[#2F6FED]/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-[#5C8FFF] uppercase tracking-wider mb-3">Situação do Contrato</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-[#94A3B8]">Valor Contratado</p>
                  <p className="text-sm font-bold text-[#5C8FFF]">{formatKz(contractInfo.totalContracted)}</p>
                  <p className="text-[10px] text-[#94A3B8]">{contractInfo.months} meses</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#94A3B8]">Já Recebido</p>
                  <p className="text-sm font-bold text-emerald-300">{formatKz(contractInfo.totalPaid)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#94A3B8]">Saldo em Falta</p>
                  <p className={`text-sm font-bold ${contractInfo.balance > 0 ? "text-red-300" : "text-emerald-300"}`}>
                    {formatKz(Math.abs(contractInfo.balance))}
                  </p>
                </div>
              </div>

              {/* progress bar */}
              <div className="mt-1">
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-[#2F6FED]"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-[#94A3B8] mt-1 text-right">{pct.toFixed(0)}% pago</p>
              </div>

              {/* balance after */}
              {newPayment > 0 && balanceAfter !== null && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold flex justify-between ${
                  balanceAfter <= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/10 text-amber-300"
                }`}>
                  <span>{balanceAfter <= 0 ? "✅ Ficará LIQUIDADO após este pagamento" : "Saldo após este pagamento:"}</span>
                  <span>{balanceAfter > 0 ? formatKz(balanceAfter) : "0,00 AOA"}</span>
                </div>
              )}
            </div>
          )}

          {/* ── VALORES ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Novo Pagamento (AOA) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Saldo em Dívida</label>
              <div className={`${inp} cursor-default opacity-70 font-semibold ${
                balanceAfter !== null
                  ? balanceAfter <= 0 ? "text-emerald-300" : "text-red-300"
                  : "text-[#94A3B8]"
              }`}>
                {balanceAfter !== null
                  ? (balanceAfter <= 0 ? "0,00 AOA — Liquidado" : formatKz(balanceAfter))
                  : contractInfo
                    ? formatKz(contractInfo.balance)
                    : "—"}
              </div>
            </div>
          </div>

          {/* ── DATAS ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Data do Pagamento *</label>
              <input
                type="date"
                value={form.paidDate}
                onChange={(e) => setForm({ ...form, paidDate: e.target.value })}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Data de Vencimento</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className={inp}
              />
            </div>
          </div>

          {/* ── MÉTODO + ESTADO ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Método de Pagamento</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className={inp}
              >
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inp}
              >
                <option value="PAGO">Pago</option>
                <option value="PENDENTE">Pendente</option>
                <option value="ATRASADO">Em Atraso</option>
              </select>
            </div>
          </div>

          {/* ── REFERÊNCIA DA OPERAÇÃO ── */}
          <div>
            <label className={lbl}>Referência da Operação (Bancária / Multicaixa / POS)</label>
            <input
              type="text"
              value={form.operationRef}
              onChange={(e) => setForm({ ...form, operationRef: e.target.value })}
              placeholder="Ex: REF-TPA-20260703-0001"
              className={inp}
            />
          </div>

          {/* ── NOTAS ── */}
          <div>
            <label className={lbl}>Observações</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className={`${inp} resize-none`}
              placeholder="Notas internas sobre este pagamento..."
            />
          </div>

          {/* ── DOCUMENTOS ── */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Documentos</p>

            {/* Doc 1 */}
            <div>
              <label className={lbl}>Comprovativo de Pagamento <span className="text-[#5C8FFF]">(PDF, PNG, JPG)</span></label>
              <div
                onClick={() => doc1Ref.current?.click()}
                className="cursor-pointer rounded-lg border-2 border-dashed border-white/15 hover:border-[#2F6FED]/50 px-4 py-3 text-center transition-colors"
              >
                {doc1 ? (
                  <p className="text-sm text-emerald-300">✓ {doc1.name}</p>
                ) : (
                  <p className="text-xs text-[#94A3B8]">Clique para anexar · Talão TPA, Comprovativo Bancário, Multicaixa Express...</p>
                )}
              </div>
              <input
                ref={doc1Ref}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => setDoc1(e.target.files?.[0] || null)}
              />
            </div>

            {/* Doc 2 */}
            <div>
              <label className={lbl}>Documento Adicional <span className="text-[#94A3B8]">(opcional) — PDF, PNG, JPG</span></label>
              <div
                onClick={() => doc2Ref.current?.click()}
                className="cursor-pointer rounded-lg border-2 border-dashed border-white/10 hover:border-[#2F6FED]/40 px-4 py-3 text-center transition-colors"
              >
                {doc2 ? (
                  <p className="text-sm text-emerald-300">✓ {doc2.name}</p>
                ) : (
                  <p className="text-xs text-[#94A3B8]">Clique para anexar · Contrato, Nota de Liquidação, Ordem de Pagamento...</p>
                )}
              </div>
              <input
                ref={doc2Ref}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => setDoc2(e.target.files?.[0] || null)}
              />
            </div>

            {(doc1 || doc2) && !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && (
              <p className="text-xs text-amber-400">
                ⚠️ Os ficheiros só serão guardados depois de configurar as variáveis CLOUDINARY_* nas definições do Vercel.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* ── ACTIONS ── */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-[#94A3B8] hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="rounded-xl bg-[#2F6FED] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1E4FB8] disabled:opacity-50 transition-colors min-w-[140px]"
            >
              {uploading ? "A enviar ficheiros..." : saving ? "A guardar..." : "Registar Pagamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
