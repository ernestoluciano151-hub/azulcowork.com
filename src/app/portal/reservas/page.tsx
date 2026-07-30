"use client";

/**
 * /portal/reservas — Lista de reservas de sala do cliente (VOL09)
 *
 * Consome: GET /api/portal/bookings
 */

import { useEffect, useState, useCallback } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import Link from "next/link";

interface Booking {
  id:            string;
  status:        string;
  startDatetime: string;
  endDatetime:   string;
  attendees:     number;
  totalPrice:    number | null;
  notes:         string | null;
  plan: {
    id:   string;
    name: string;
  };
}

interface Pagination {
  page: number; limit: number; total: number; pages: number;
}

function fmtKz(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("pt-AO", {
    style: "currency", currency: "AOA", minimumFractionDigits: 2,
  }).format(n);
}

function fmtDatetime(d: string) {
  return new Date(d).toLocaleString("pt-AO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  PENDENTE_APROVACAO: { label: "Pendente",    cls: "bg-yellow-100 text-yellow-700" },
  RESERVADO:          { label: "Reservado",   cls: "bg-blue-100 text-blue-700" },
  CONFIRMADA:         { label: "Confirmada",  cls: "bg-green-100 text-green-700" },
  CONCLUIDA:          { label: "Concluída",   cls: "bg-gray-100 text-gray-600" },
  CANCELADA:          { label: "Cancelada",   cls: "bg-red-100 text-red-600" },
  NO_SHOW:            { label: "Não Compareceu", cls: "bg-gray-100 text-gray-500" },
};

function ReservasContent() {
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [page,       setPage]       = useState(1);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/portal/bookings?page=${page}&limit=20`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar reservas.");
      setBookings(json.data ?? []);
      setPagination(json.pagination);
    } catch {
      setError("Não foi possível carregar as reservas.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  async function handleCancel(bookingId: string) {
    if (!confirm("Tem a certeza que pretende cancelar esta reserva?")) return;
    setCancelling(bookingId);
    try {
      const res = await fetch(`/api/portal/bookings/${bookingId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        alert(json.error ?? "Erro ao cancelar reserva.");
        return;
      }
      await load();
    } catch {
      alert("Erro ao cancelar reserva. Tente novamente.");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
        <Link
          href="/portal/reservas/nova"
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
        >
          + Nova Reserva
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-10 text-red-600 text-sm">{error}</div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">🗓️</div>
          <div className="text-gray-500 text-sm mb-4">
            Nenhuma reserva encontrada.
          </div>
          <Link
            href="/portal/reservas/nova"
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Reservar sala de reunião
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const st = STATUS_STYLE[b.status] ?? { label: b.status, cls: "bg-gray-100 text-gray-600" };
            const canCancel = ["PENDENTE_APROVACAO", "RESERVADO"].includes(b.status);
            const isPast    = new Date(b.endDatetime) < new Date();
            return (
              <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-900">{b.plan.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>
                        {st.label}
                      </span>
                      {isPast && b.status !== "CANCELADA" && (
                        <span className="text-xs text-gray-400">(passada)</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {fmtDatetime(b.startDatetime)} → {fmtDatetime(b.endDatetime)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {b.attendees} participante{b.attendees !== 1 ? "s" : ""}
                      {b.totalPrice !== null && ` · ${fmtKz(b.totalPrice)}`}
                    </div>
                    {b.notes && (
                      <div className="text-xs text-gray-500 mt-1 italic">{b.notes}</div>
                    )}
                  </div>
                  {canCancel && !isPast && (
                    <button
                      onClick={() => handleCancel(b.id)}
                      disabled={cancelling === b.id}
                      className="text-xs text-red-600 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                      {cancelling === b.id ? "..." : "Cancelar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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

export default function PortalReservasPage() {
  return (
    <PortalLayout>
      <ReservasContent />
    </PortalLayout>
  );
}
