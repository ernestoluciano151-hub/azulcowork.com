"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/admin/Sidebar";
import ReservationModal from "@/components/admin/ReservationModal";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

export type MeetingPlan = {
  id: string;
  name: string;
  maxPeople: number;
  description?: string | null;
  coffeeBreakAvailable: boolean;
  customPricingAllowed: boolean;
  minHoursForCustom?: number | null;
  active: boolean;
};

export type Reservation = {
  id: string;
  eventName: string;
  companyName?: string | null;
  responsible: string;
  planId: string;
  plan?: MeetingPlan;
  participants: number;
  startDatetime: string;
  endDatetime: string;
  totalHours: number;
  coffeeBreak: boolean;
  observations?: string | null;
  status: string;
  isCustomPricing: boolean;
  customRequest?: string | null;
  createdAt: string;
};

const PLAN_COLORS: Record<string, string> = {
  Alpha: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Beta: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Gamma: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Easy: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  Personalizado: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  CONFIRMADA: "bg-emerald-500/15 text-emerald-300",
  CANCELADA: "bg-red-500/15 text-red-300",
  PENDENTE_APROVACAO: "bg-amber-500/15 text-amber-300",
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
  PENDENTE_APROVACAO: "Pendente Aprovação",
};

function getPlanColor(planName: string) {
  return PLAN_COLORS[planName] || "bg-white/10 text-mist border-white/10";
}

export default function SalasPage() {
  const [plans, setPlans] = useState<MeetingPlan[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [creatingReservation, setCreatingReservation] = useState(false);

  // Stats
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const next7End = new Date(now.getTime() + 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const todayRes = reservations.filter(r =>
    r.status === "CONFIRMADA" &&
    new Date(r.startDatetime) >= todayStart &&
    new Date(r.startDatetime) < todayEnd
  );
  const next7Res = reservations.filter(r =>
    r.status === "CONFIRMADA" &&
    new Date(r.startDatetime) >= now &&
    new Date(r.startDatetime) <= next7End
  );
  const monthRes = reservations.filter(r =>
    r.status === "CONFIRMADA" &&
    new Date(r.startDatetime) >= monthStart &&
    new Date(r.startDatetime) <= monthEnd
  );
  const monthHours = monthRes.reduce((acc, r) => acc + r.totalHours, 0);
  // Assuming 8h/day * workdays (approximate with 22 days)
  const occupancyRate = Math.min(100, Math.round((monthHours / (22 * 8)) * 100));

  const pendingApproval = reservations.filter(r => r.status === "PENDENTE_APROVACAO");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus !== "ALL") params.set("status", filterStatus);
    if (filterDateFrom) params.set("from", new Date(filterDateFrom).toISOString());
    if (filterDateTo) params.set("to", new Date(filterDateTo + "T23:59:59").toISOString());

    const [plansRes, resRes] = await Promise.all([
      fetch("/api/plans"),
      fetch(`/api/reservations?${params.toString()}`)
    ]);
    if (plansRes.ok) {
      const d = await plansRes.json();
      setPlans(d.plans);
    }
    if (resRes.ok) {
      const d = await resRes.json();
      setReservations(d.reservations);
    }
    setLoading(false);
  }, [filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function approveReservation(id: string) {
    await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMADA" })
    });
    fetchAll();
  }

  async function rejectReservation(id: string) {
    await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELADA" })
    });
    fetchAll();
  }

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-paper">Sala de Reunião</h1>
            <p className="mt-1 text-sm text-mist">Azul Cowork — Sala única com planos de utilização</p>
          </div>
          <button
            onClick={() => setCreatingReservation(true)}
            className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-medium text-white hover:bg-azul-dim"
          >
            + Nova Reserva
          </button>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-medium text-mist">Reservas hoje</p>
            <p className="mt-2 text-3xl font-bold text-paper">{todayRes.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-medium text-mist">Próximos 7 dias</p>
            <p className="mt-2 text-3xl font-bold text-paper">{next7Res.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-medium text-mist">Horas este mês</p>
            <p className="mt-2 text-3xl font-bold text-paper">{monthHours.toFixed(1)}h</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-medium text-mist">Taxa de ocupação</p>
            <p className="mt-2 text-3xl font-bold text-paper">{occupancyRate}%</p>
          </div>
        </div>

        {/* Plans section */}
        <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-mist">Planos Disponíveis</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {plans.map((plan) => {
            const colorCls = getPlanColor(plan.name);
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-4 bg-white/[0.03] ${colorCls.split(" ")[2] || "border-white/10"}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className={`font-display text-sm font-bold ${colorCls.split(" ")[1]}`}>{plan.name}</h3>
                  {plan.coffeeBreakAvailable && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">☕ CB</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-mist">Até {plan.maxPeople} pessoas</p>
                {plan.description && (
                  <p className="mt-2 text-[11px] text-mist line-clamp-3">{plan.description}</p>
                )}
                {plan.customPricingAllowed && (
                  <p className="mt-2 text-[11px] text-amber-300">Preço negociável · mín. {plan.minHoursForCustom}h</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Pedidos Personalizados */}
        {pendingApproval.length > 0 && (
          <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <h2 className="font-display text-lg font-bold text-amber-300">Pedidos Personalizados — Aguardam Aprovação</h2>
            <ul className="mt-4 divide-y divide-white/5">
              {pendingApproval.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm">
                  <div>
                    <p className="font-medium text-paper">{r.eventName}</p>
                    <p className="text-mist">{r.responsible} {r.companyName ? `· ${r.companyName}` : ""}</p>
                    <p className="text-mist">
                      {format(new Date(r.startDatetime), "dd/MM/yyyy HH:mm", { locale: pt })} –{" "}
                      {format(new Date(r.endDatetime), "HH:mm")} · {r.totalHours.toFixed(1)}h
                    </p>
                    {r.customRequest && (
                      <p className="mt-1 text-xs text-amber-300">Pedido: {r.customRequest}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveReservation(r.id)}
                      className="focus-ring rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20"
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={() => rejectReservation(r.id)}
                      className="focus-ring rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
                    >
                      Rejeitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Filters */}
        <div className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            <option value="ALL">Todos os estados</option>
            <option value="CONFIRMADA">Confirmada</option>
            <option value="CANCELADA">Cancelada</option>
            <option value="PENDENTE_APROVACAO">Pendente Aprovação</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-mist">De</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-mist">Até</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
            />
          </div>
          <button
            onClick={() => { setFilterStatus("ALL"); setFilterDateFrom(""); setFilterDateTo(""); }}
            className="focus-ring rounded-lg border border-white/10 px-3 py-2 text-xs text-mist hover:bg-white/5"
          >
            Limpar filtros
          </button>
        </div>

        {/* Reservas table */}
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-mist">
              <tr>
                <th className="px-4 py-3 font-medium">Evento</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Part.</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Início</th>
                <th className="px-4 py-3 font-medium">Fim</th>
                <th className="px-4 py-3 font-medium">Total h</th>
                <th className="px-4 py-3 font-medium">CB</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-mist">A carregar...</td></tr>
              )}
              {!loading && reservations.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-mist">Sem reservas encontradas.</td></tr>
              )}
              {reservations.map((r) => {
                const planName = r.plan?.name || "—";
                const planColorCls = getPlanColor(planName);
                return (
                  <tr key={r.id} className="text-paper hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium">{r.eventName}</td>
                    <td className="px-4 py-3 text-mist">{r.companyName || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${planColorCls.split(" ")[0]} ${planColorCls.split(" ")[1]}`}>
                        {planName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-mist">{r.participants}</td>
                    <td className="px-4 py-3 text-mist">{format(new Date(r.startDatetime), "dd/MM/yyyy")}</td>
                    <td className="px-4 py-3 text-mist">{format(new Date(r.startDatetime), "HH:mm")}</td>
                    <td className="px-4 py-3 text-mist">{format(new Date(r.endDatetime), "HH:mm")}</td>
                    <td className="px-4 py-3 text-mist">{r.totalHours.toFixed(1)}h</td>
                    <td className="px-4 py-3 text-mist">{r.coffeeBreak ? "☕" : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] || "bg-white/10 text-mist"}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingReservation(r)}
                        className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {editingReservation && (
        <ReservationModal
          reservation={editingReservation}
          plans={plans}
          onClose={() => setEditingReservation(null)}
          onSaved={fetchAll}
        />
      )}
      {creatingReservation && (
        <ReservationModal
          plans={plans}
          onClose={() => setCreatingReservation(false)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}
