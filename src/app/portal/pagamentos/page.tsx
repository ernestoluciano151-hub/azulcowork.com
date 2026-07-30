"use client";

/**
 * /portal/pagamentos — Histórico de pagamentos + recibos (VOL09)
 *
 * Consome: GET /api/portal/payments
 */

import { useEffect, useState, useCallback } from "react";
import PortalLayout from "@/components/portal/PortalLayout";

interface Payment {
  id:          string;
  amount:      number;
  method:      string;
  status:      string;
  reference:   string | null;
  confirmedAt: string | null;
  createdAt:   string;
  invoiceId:   string | null;
  invoice: {
    number: string;
    total:  number;
  } | null;
}

interface Pagination {
  page: number; limit: number; total: number; pages: number;
}

function fmtKz(n: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency", currency: "AOA", minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-AO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER:   "Transferência Bancária",
  CASH:            "Numerário",
  MOBILE_MONEY:    "Mobile Money",
  CREDIT_CARD:     "Cartão de Crédito",
  CHECK:           "Cheque",
  OTHER:           "Outro",
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "Pendente",   cls: "bg-yellow-100 text-yellow-700" },
  CONFIRMED: { label: "Confirmado", cls: "bg-green-100 text-green-700" },
  REJECTED:  { label: "Rejeitado",  cls: "bg-red-100 text-red-700" },
  REVERSED:  { label: "Revertido",  cls: "bg-gray-100 text-gray-500" },
};

function PagamentosContent() {
  const [payments,   setPayments]   = useState<Payment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [page,       setPage]       = useState(1);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/portal/payments?page=${page}&limit=20`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar pagamentos.");
      setPayments(json.data);
      setPagination(json.pagination);
    } catch {
      setError("Não foi possível carregar o histórico de pagamentos.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  async function handleReceipt(paymentId: string) {
    setDownloading(paymentId);
    try {
      const res  = await fetch(`/api/portal/payments/${paymentId}/receipt`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar recibo.");
      window.open(json.data.url, "_blank");
    } catch {
      alert("Não foi possível gerar o recibo. Tente novamente.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-10 text-red-600 text-sm">{error}</div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">💳</div>
          <div className="text-gray-500 text-sm">Nenhum pagamento registado.</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Data</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs hidden sm:table-cell">Método</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs hidden md:table-cell">Fatura</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Estado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map((p) => {
                const st = STATUS_STYLE[p.status] ?? { label: p.status, cls: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-800">
                      {fmtDate(p.confirmedAt ?? p.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {METHOD_LABEL[p.method] ?? p.method}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell font-mono text-xs">
                      {p.invoice?.number ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {fmtKz(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status === "CONFIRMED" && (
                        <button
                          onClick={() => handleReceipt(p.id)}
                          disabled={downloading === p.id}
                          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {downloading === p.id ? "..." : "Recibo"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50"
          >
            ← Anterior
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">{page} / {pagination.pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages || loading}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50"
          >
            Seguinte →
          </button>
        </div>
      )}
    </div>
  );
}

export default function PortalPagamentosPage() {
  return (
    <PortalLayout>
      <PagamentosContent />
    </PortalLayout>
  );
}
