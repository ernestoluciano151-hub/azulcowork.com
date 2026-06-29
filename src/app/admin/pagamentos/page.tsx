"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import { formatKz } from "@/lib/currency";
import { format } from "date-fns";
import DeleteRequestModal from "@/components/admin/DeleteRequestModal";

const STATUS_COLORS: Record<string, string> = {
  PAGO: "bg-emerald-500/15 text-emerald-300",
  PENDENTE: "bg-amber-500/15 text-amber-300",
  ATRASADO: "bg-red-500/15 text-red-300",
};

type Payment = {
  id: string;
  companyId: string;
  company: { id: string; name: string };
  dueDate: string;
  paidDate: string | null;
  amount: number;
  status: string;
  notes: string | null;
};

type Summary = { pago: number; pendente: number; atrasado: number };

export default function PagamentosPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary>({ pago: 0, pendente: 0, atrasado: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [month, setMonth] = useState("");
  const [q, setQ] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!d || d.role !== "ADMIN") router.push("/admin/dashboard"); })
      .catch(() => router.push("/admin/dashboard"));
  }, [router]);

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

  async function markAsPago(payment: Payment) {
    setMarkingId(payment.id);
    await fetch(`/api/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAGO", paidDate: new Date().toISOString() }),
    });
    setMarkingId(null);
    fetchPayments();
  }

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-paper">Pagamentos &amp; Fluxo de Caixa</h1>
          <p className="mt-1 text-sm text-mist">{payments.length} pagamento(s) encontrado(s).</p>
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Total recebido</p>
            <p className="mt-2 text-2xl font-bold text-emerald-300">{formatKz(summary.pago)}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Total pendente</p>
            <p className="mt-2 text-2xl font-bold text-amber-300">{formatKz(summary.pendente)}</p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Total em atraso</p>
            <p className="mt-2 text-2xl font-bold text-red-300">{formatKz(summary.atrasado)}</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-5 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por empresa..."
            className="focus-ring min-w-[200px] flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            <option value="ALL">Todos os estados</option>
            <option value="PAGO">Pago</option>
            <option value="PENDENTE">Pendente</option>
            <option value="ATRASADO">Atrasado</option>
          </select>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-mist">
              <tr>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 font-medium">Valor (AOA)</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Data Pagamento</th>
                <th className="px-4 py-3 font-medium">Notas</th>
                <th className="px-4 py-3 font-medium">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-mist">A carregar...</td></tr>
              )}
              {!loading && payments.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-mist">Nenhum pagamento encontrado.</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="text-paper hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">{p.company.name}</td>
                  <td className="px-4 py-3">{format(new Date(p.dueDate), "dd/MM/yyyy")}</td>
                  <td className="px-4 py-3">{formatKz(p.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[p.status] || "bg-white/10 text-mist"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-mist">
                    {p.paidDate ? format(new Date(p.paidDate), "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 max-w-[180px] text-mist text-xs truncate" title={p.notes || ""}>
                    {p.notes || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {(p.status === "PENDENTE" || p.status === "ATRASADO") && (
                        <button
                          onClick={() => markAsPago(p)}
                          disabled={markingId === p.id}
                          className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                          {markingId === p.id ? "..." : "Marcar como Pago"}
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteModal({ id: p.id, label: `Pagamento ${p.company.name} — ${format(new Date(p.dueDate), "MM/yyyy")}` })}
                        className="rounded-lg border border-red-500/20 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                        title="Pedir eliminação"
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
      </main>

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
