"use client";

/**
 * /portal/faturas/[id] — Detalhe de fatura + download (VOL09)
 *
 * Consome:
 *   GET /api/portal/invoices/[id]
 *   GET /api/portal/invoices/[id]/download  → URL assinada Cloudinary
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import PortalLayout from "@/components/portal/PortalLayout";
import Link from "next/link";

interface InvoiceDetail {
  id:           string;
  number:       string;
  type:         string;
  status:       string;
  issueDate:    string;
  dueDate:      string | null;
  periodStart:  string | null;
  periodEnd:    string | null;
  description:  string | null;
  subtotal:     number;
  taxRate:      number;
  taxAmount:    number;
  discount:     number;
  total:        number;
  paidAt:       string | null;
  sentAt:       string | null;
  notes:        string | null;
  company: {
    name:   string;
    nif:    string | null;
    email:  string | null;
    address:string | null;
  };
  items: {
    id:          string;
    description: string;
    quantity:    number;
    unitPrice:   number;
    total:       number;
  }[];
}

function fmtKz(n: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency", currency: "AOA", minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-AO", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  DRAFT:          { label: "Rascunho",          cls: "bg-gray-100 text-gray-600" },
  ISSUED:         { label: "Emitida",            cls: "bg-blue-100 text-blue-700" },
  SENT:           { label: "Enviada",            cls: "bg-indigo-100 text-indigo-700" },
  PAID:           { label: "Paga",               cls: "bg-green-100 text-green-700" },
  OVERDUE:        { label: "Em Atraso",          cls: "bg-red-100 text-red-700" },
  PARTIALLY_PAID: { label: "Parcialmente Paga",  cls: "bg-amber-100 text-amber-700" },
  CANCELLED:      { label: "Cancelada",          cls: "bg-gray-100 text-gray-500" },
  VOID:           { label: "Anulada",            cls: "bg-gray-100 text-gray-400" },
};

function FaturaDetail() {
  const params  = useParams();
  const router  = useRouter();
  const id      = params.id as string;

  const [invoice,      setInvoice]      = useState<InvoiceDetail | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [downloading,  setDownloading]  = useState(false);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/portal/invoices/${id}`);
      const json = await res.json();
      if (res.status === 404) { router.replace("/portal/faturas"); return; }
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar fatura.");
      setInvoice(json.data);
    } catch {
      setError("Não foi possível carregar a fatura.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res  = await fetch(`/api/portal/invoices/${id}/download`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar download.");
      window.open(json.data.url, "_blank");
    } catch {
      alert("Não foi possível gerar o download. Tente novamente.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !invoice) {
    return <div className="p-8 text-center text-red-600 text-sm">{error}</div>;
  }

  const st = STATUS_STYLE[invoice.status] ?? { label: invoice.status, cls: "bg-gray-100 text-gray-600" };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/portal/faturas" className="text-sm text-gray-400 hover:text-gray-600">
          ← Faturas
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-gray-400 mb-1">Fatura</div>
            <div className="font-mono font-bold text-gray-900 text-lg">{invoice.number}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${st.cls}`}>
              {st.label}
            </span>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {downloading ? "A gerar..." : "⬇ Descarregar PDF"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Data de Emissão</div>
            <div className="font-medium">{fmtDate(invoice.issueDate)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Data de Vencimento</div>
            <div className={`font-medium ${invoice.status === "OVERDUE" ? "text-red-600" : ""}`}>
              {fmtDate(invoice.dueDate)}
            </div>
          </div>
          {invoice.paidAt && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Pago em</div>
              <div className="font-medium text-green-600">{fmtDate(invoice.paidAt)}</div>
            </div>
          )}
          {invoice.periodStart && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Período</div>
              <div className="font-medium">
                {fmtDate(invoice.periodStart)} – {fmtDate(invoice.periodEnd)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Itens */}
      {invoice.items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Descrição</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">Qtd</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">Preço Unit.</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-800">{item.description}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmtKz(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmtKz(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totais */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="space-y-2 text-sm max-w-xs ml-auto">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span>{fmtKz(invoice.subtotal)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Desconto</span>
              <span>-{fmtKz(invoice.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">IVA ({invoice.taxRate}%)</span>
            <span>{fmtKz(invoice.taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2 mt-2">
            <span>Total</span>
            <span>{fmtKz(invoice.total)}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-sm text-gray-600">
          <div className="font-medium text-gray-700 mb-1">Notas</div>
          {invoice.notes}
        </div>
      )}
    </div>
  );
}

export default function PortalFaturaDetailPage() {
  return (
    <PortalLayout>
      <FaturaDetail />
    </PortalLayout>
  );
}
