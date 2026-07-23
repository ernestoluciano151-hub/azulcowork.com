"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { formatKz } from "@/lib/currency";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────────
type Reservation = {
  id: string; reservationNumber?: string | null;
  eventName: string; companyName?: string | null; companyId?: string | null;
  responsible: string; email?: string | null; whatsapp?: string | null;
  plan: { id: string; name: string; pricePerHour: number };
  participants: number; startDatetime: string; endDatetime: string;
  totalHours: number; coffeeBreak: boolean; observations?: string | null;
  status: string; paymentOption: string; amount: number; discount: number;
  iva: number; totalAmount: number; paymentStatus: string; amountPaid: number;
  paymentMethod?: string | null; operationRef?: string | null;
  receiptUrl?: string | null; financialNotes?: string | null;
  createdAt: string; updatedAt: string;
  company?: { id: string; name: string; nif?: string | null; email: string; whatsapp: string } | null;
};

type Invoice = {
  id: string; invoiceNumber: string; status: string; amount: number;
  totalAmount: number; amountPaid: number; balance: number; paidPercentage: number;
  issueDate: string; dueDate: string; paymentMethod?: string | null;
  serviceType: string; notes?: string | null;
  invoicePayments: Array<{
    id: string; amount: number; paymentMethod?: string | null;
    operationRef?: string | null; paidDate: string; createdBy?: string | null;
  }>;
};

type Payment = {
  id: string; receiptNumber?: string | null; amount: number; status: string;
  paidDate?: string | null; paymentMethod?: string | null; receiptUrl?: string | null;
  operationRef?: string | null; createdAt: string;
};

type LiquidationNote = {
  id: string; noteNumber: string; createdAt: string;
};

const STATUS_BADGE: Record<string, string> = {
  CONFIRMADA:         "bg-emerald-500/15 text-emerald-300",
  RESERVADO:          "bg-blue-500/15 text-blue-300",
  PENDENTE_APROVACAO: "bg-amber-500/15 text-amber-300",
  CANCELADA:          "bg-red-500/15 text-red-300",
  CONCLUIDA:          "bg-indigo-500/15 text-indigo-300",
};

const PAY_STATUS_BADGE: Record<string, string> = {
  PAGO:       "bg-emerald-500/15 text-emerald-300",
  PENDENTE:   "bg-amber-500/15 text-amber-300",
  PARCIAL:    "bg-blue-500/15 text-blue-300",
  FACTURADO:  "bg-indigo-500/15 text-indigo-300",
  ISENTO:     "bg-white/10 text-mist",
};

const fmt = (d: string) => format(new Date(d), "dd/MM/yyyy HH:mm", { locale: pt });
const fmtDate = (d: string) => format(new Date(d), "dd/MM/yyyy", { locale: pt });

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [res,     setRes]     = useState<Reservation     | null>(null);
  const [invoice, setInvoice] = useState<Invoice         | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notes,   setNotes]   = useState<LiquidationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/reservations/${id}`);
    if (!r.ok) { setError("Reserva não encontrada."); setLoading(false); return; }
    const d = await r.json();
    setRes(d.reservation);
    setInvoice(d.invoice);
    setPayments(d.payments || []);
    setNotes(d.liquidationNotes || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function cancelReservation() {
    if (!confirm("Cancelar esta reserva?")) return;
    await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    showToast("Reserva cancelada.", true);
    fetchData();
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-1 items-center justify-center h-full">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2F6FED] border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !res) {
    return (
      <AdminLayout>
        <div className="flex flex-1 items-center justify-center flex-col gap-4 h-full">
          <p className="text-red-400">{error || "Reserva não encontrada."}</p>
          <button onClick={() => router.back()} className="text-[#5C8FFF] hover:underline text-sm">← Voltar</button>
        </div>
      </AdminLayout>
    );
  }

  const balance    = res.totalAmount - res.amountPaid;
  const pct        = res.totalAmount > 0 ? Math.min(100, (res.amountPaid / res.totalAmount) * 100) : 0;

  return (
    <AdminLayout className="px-6 py-8">
      {toast && (
        <div className={`fixed right-6 top-6 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${toast.ok ? "bg-emerald-600" : "bg-red-600"} text-white`}>
          {toast.msg}
        </div>
      )}
        <div className="max-w-5xl mx-auto space-y-6">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <button onClick={() => router.back()} className="text-[#94A3B8] hover:text-[#F5F7FA] text-sm">← Voltar</button>
                <span className="text-[#94A3B8]">/</span>
                <Link href="/admin/salas" className="text-[#94A3B8] hover:text-[#F5F7FA] text-sm">Salas</Link>
              </div>
              <h1 className="text-2xl font-bold text-[#F5F7FA]">{res.eventName}</h1>
              <p className="text-sm text-[#94A3B8] mt-0.5">
                {res.reservationNumber && <span className="font-mono text-[#5C8FFF] mr-3">{res.reservationNumber}</span>}
                Criada em {fmtDate(res.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[res.status] || "bg-white/10 text-mist"}`}>{res.status}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${PAY_STATUS_BADGE[res.paymentStatus] || "bg-white/10 text-mist"}`}>{res.paymentStatus}</span>
              {res.status !== "CANCELADA" && (
                <button onClick={cancelReservation} className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                  Cancelar reserva
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT: main info (2/3) ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Dados gerais */}
              <section className="rounded-2xl border border-white/10 bg-[#0d1829] p-5">
                <h2 className="text-sm font-bold text-[#F5F7FA] mb-4">Dados da Reserva</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Row label="Responsável"    value={res.responsible} />
                  <Row label="Email"          value={res.email    || "—"} />
                  <Row label="WhatsApp"       value={res.whatsapp || "—"} />
                  <Row label="Empresa"        value={res.companyName || res.company?.name || "—"} />
                  <Row label="Plano"          value={res.plan.name} />
                  <Row label="Participantes"  value={String(res.participants)} />
                  <Row label="Início"         value={fmt(res.startDatetime)} />
                  <Row label="Fim"            value={fmt(res.endDatetime)} />
                  <Row label="Duração"        value={`${res.totalHours.toFixed(1)} horas`} />
                  <Row label="Coffee Break"   value={res.coffeeBreak ? "☕ Sim" : "Não"} />
                  {res.observations && <div className="col-span-2"><Row label="Observações" value={res.observations} /></div>}
                </div>
              </section>

              {/* Financeiro resumo */}
              <section className="rounded-2xl border border-white/10 bg-[#0d1829] p-5">
                <h2 className="text-sm font-bold text-[#F5F7FA] mb-4">Resumo Financeiro</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Row label="Valor base"      value={formatKz(res.amount)} />
                  {res.discount > 0 && <Row label="Desconto"      value={`− ${formatKz(res.discount)}`} />}
                  {res.iva      > 0 && <Row label="IVA"           value={`${res.iva}%`} />}
                  <Row label="Total"           value={formatKz(res.totalAmount)} className="text-[#5C8FFF] font-semibold" />
                  <Row label="Pago"            value={formatKz(res.amountPaid)} className={res.amountPaid >= res.totalAmount ? "text-emerald-300" : "text-amber-300"} />
                  <Row label="Saldo"           value={formatKz(balance)}       className={balance <= 0 ? "text-emerald-300" : "text-red-300"} />
                  <Row label="Opção pagamento" value={res.paymentOption} />
                  {res.paymentMethod && <Row label="Método" value={res.paymentMethod} />}
                  {res.operationRef  && <Row label="Referência" value={res.operationRef} />}
                  {res.financialNotes && <div className="col-span-2"><Row label="Notas" value={res.financialNotes} /></div>}
                </div>

                {res.totalAmount > 0 && (
                  <div className="mt-4">
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-[#2F6FED]"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-[#94A3B8] mt-1 text-right">{pct.toFixed(0)}% liquidado</p>
                  </div>
                )}

                {res.receiptUrl && (
                  <a href={res.receiptUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#5C8FFF] hover:underline">
                    📎 Ver comprovativo
                  </a>
                )}
              </section>

              {/* Pagamentos recebidos */}
              {payments.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-[#0d1829] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10">
                    <h2 className="text-sm font-bold text-[#F5F7FA]">Pagamentos Recebidos</h2>
                  </div>
                  <div className="divide-y divide-white/5">
                    {payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                        <div>
                          <p className="font-mono text-xs text-[#5C8FFF]">{p.receiptNumber || "—"}</p>
                          <p className="text-[#F5F7FA] font-medium">{formatKz(p.amount)}</p>
                          <p className="text-xs text-[#94A3B8]">
                            {p.paidDate ? fmtDate(p.paidDate) : fmtDate(p.createdAt)}
                            {p.paymentMethod && ` · ${p.paymentMethod}`}
                            {p.operationRef  && ` · ref: ${p.operationRef}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.receiptUrl && (
                            <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-[#5C8FFF] hover:underline">Doc</a>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "PAGO" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                            {p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* ── RIGHT: sidebar (1/3) ── */}
            <div className="space-y-5">

              {/* Fatura */}
              {invoice ? (
                <section className="rounded-2xl border border-[#2F6FED]/25 bg-[#2F6FED]/5 p-5">
                  <h2 className="text-sm font-bold text-[#5C8FFF] mb-3">📄 Fatura</h2>
                  <p className="font-mono text-sm text-[#F5F7FA] font-semibold">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">{invoice.serviceType}</p>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">Total</span>
                      <span className="text-[#F5F7FA] font-medium">{formatKz(invoice.totalAmount || invoice.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">Pago</span>
                      <span className="text-emerald-300 font-medium">{formatKz(invoice.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">Saldo</span>
                      <span className={`font-medium ${invoice.balance <= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatKz(invoice.balance)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      invoice.status === "LIQUIDADA" ? "bg-emerald-500/15 text-emerald-300"
                      : invoice.status === "PARCIAL"  ? "bg-blue-500/15 text-blue-300"
                      : "bg-amber-500/15 text-amber-300"
                    }`}>
                      {invoice.status}
                    </span>
                    <a href={`/api/invoices/${invoice.id}/download`} className="text-xs text-[#5C8FFF] hover:underline">
                      📄 Fatura
                    </a>
                    <a href={`/api/invoices/${invoice.id}/receipt`} className="text-xs text-emerald-400 hover:underline">
                      🧾 Recibo
                    </a>
                  </div>

                  {/* InvoicePayments breakdown */}
                  {invoice.invoicePayments.length > 0 && (
                    <div className="mt-4 border-t border-white/10 pt-3 space-y-2">
                      <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Parcelas</p>
                      {invoice.invoicePayments.map(ip => (
                        <div key={ip.id} className="flex justify-between text-xs">
                          <span className="text-[#94A3B8]">{fmtDate(ip.paidDate)}{ip.paymentMethod ? ` · ${ip.paymentMethod}` : ""}</span>
                          <span className="text-emerald-300 font-medium">{formatKz(ip.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : (
                <section className="rounded-2xl border border-white/10 bg-[#0d1829] p-5">
                  <h2 className="text-sm font-bold text-[#94A3B8] mb-2">📄 Fatura</h2>
                  <p className="text-xs text-[#94A3B8]">Nenhuma fatura emitida para esta reserva.</p>
                </section>
              )}

              {/* Notas de Liquidação */}
              {notes.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-[#0d1829] p-5">
                  <h2 className="text-sm font-bold text-[#F5F7FA] mb-3">📋 Notas de Liquidação</h2>
                  <div className="space-y-2">
                    {notes.map(n => (
                      <div key={n.id} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-[#5C8FFF]">{n.noteNumber}</span>
                        <span className="text-[#94A3B8]">{fmtDate(n.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Quick links */}
              <section className="rounded-2xl border border-white/10 bg-[#0d1829] p-5 space-y-2">
                <h2 className="text-sm font-bold text-[#F5F7FA] mb-3">Acções</h2>
                <Link href="/admin/salas" className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#F5F7FA]">
                  🏠 Voltar às Reservas
                </Link>
                <Link href="/admin/calendario" className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#F5F7FA]">
                  📅 Ver Calendário
                </Link>
                {res.companyId && (
                  <Link href={`/admin/financeiro/empresa/${res.companyId}`} className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#F5F7FA]">
                    🏢 Perfil da Empresa
                  </Link>
                )}
                {res.whatsapp && (
                  <>
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-2">WhatsApp</p>
                      <a
                        href={`https://wa.me/${res.whatsapp.replace(/\D/g,"")}?text=${encodeURIComponent(
                          `✅ *Reserva Confirmada — Azul Coworking*\n\nOlá ${res.responsible}! A sua reserva foi confirmada:\n\n📋 *Evento:* ${res.eventName}\n🕐 *Início:* ${fmtDate(res.startDatetime)}\n💰 *Valor:* ${formatKz(res.totalAmount)}\n\n📍 Bairro Azul, Edifício 18, Luanda\n\nObrigado! 🔵`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-[#25D366] hover:underline"
                      >
                        📲 Confirmar via WhatsApp
                      </a>
                      <a
                        href={`https://wa.me/${res.whatsapp.replace(/\D/g,"")}?text=${encodeURIComponent(
                          `⏰ *Lembrete — Azul Coworking*\n\nOlá ${res.responsible}! Lembramos a sua reserva:\n\n📋 *Evento:* ${res.eventName}\n🕐 *Data:* ${fmtDate(res.startDatetime)}\n\n📍 Bairro Azul, Edifício 18, Luanda\n\nAté breve! 🔵`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#25D366] mt-1"
                      >
                        🔔 Enviar Lembrete
                      </a>
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
    </AdminLayout>
  );
}

function Row({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">{label}</p>
      <p className={`text-[#F5F7FA] mt-0.5 ${className}`}>{value}</p>
    </div>
  );
}
