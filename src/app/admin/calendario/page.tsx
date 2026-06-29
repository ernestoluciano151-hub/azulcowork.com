"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/admin/Sidebar";
import ReservationModal, { Reservation, MeetingPlan } from "@/components/admin/ReservationModal";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { pt } from "date-fns/locale";

const PLAN_COLORS: Record<string, string> = {
  Alpha: "bg-blue-500/20 text-blue-300",
  Beta: "bg-purple-500/20 text-purple-300",
  Gamma: "bg-emerald-500/20 text-emerald-300",
  Easy: "bg-teal-500/20 text-teal-300",
  Personalizado: "bg-amber-500/20 text-amber-300",
};

function getPlanColor(planName: string) {
  return PLAN_COLORS[planName] || "bg-white/10 text-mist";
}

export default function CalendarioPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [plans, setPlans] = useState<MeetingPlan[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [creatingReservation, setCreatingReservation] = useState(false);

  const fetchData = useCallback(async () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const [resRes, plansRes] = await Promise.all([
      fetch(`/api/reservations?from=${monthStart.toISOString()}&to=${monthEnd.toISOString()}`),
      fetch("/api/plans")
    ]);

    if (resRes.ok) {
      const d = await resRes.json();
      setReservations(d.reservations);
    }
    if (plansRes.ok) {
      const d = await plansRes.json();
      setPlans(d.plans);
    }
  }, [currentMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function getReservationsForDay(date: Date) {
    return reservations.filter((r) => isSameDay(new Date(r.startDatetime), date));
  }

  // Check conflicts: overlapping reservations on same day
  function hasConflict(dayRes: Reservation[]) {
    const confirmed = dayRes.filter(r => r.status === "CONFIRMADA" || r.status === "PENDENTE_APROVACAO");
    for (let i = 0; i < confirmed.length; i++) {
      for (let j = i + 1; j < confirmed.length; j++) {
        if (
          new Date(confirmed[i].startDatetime) < new Date(confirmed[j].endDatetime) &&
          new Date(confirmed[i].endDatetime) > new Date(confirmed[j].startDatetime)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const dayReservations = selectedDay ? getReservationsForDay(selectedDay) : [];

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-paper">Calendário</h1>
            <p className="mt-1 text-sm text-mist">Reservas da sala de reunião — Azul Cowork</p>
          </div>
          <button
            onClick={() => setCreatingReservation(true)}
            className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-medium text-white hover:bg-azul-dim"
          >
            + Nova Reserva
          </button>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-2">
          {plans.map((plan) => (
            <span key={plan.id} className={`rounded-full px-3 py-1 text-xs font-medium ${getPlanColor(plan.name)}`}>
              {plan.name} · máx. {plan.maxPeople}p
            </span>
          ))}
        </div>

        {/* Month navigation */}
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3">
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-sm text-paper hover:bg-white/5"
          >
            ← Anterior
          </button>
          <h2 className="font-display text-lg font-semibold text-paper capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: pt })}
          </h2>
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-sm text-paper hover:bg-white/5"
          >
            Seguinte →
          </button>
        </div>

        {/* Calendar grid */}
        <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-7 bg-white/[0.05]">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <div key={d} className="px-3 py-2 text-center text-xs font-semibold text-mist">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-white/5">
            {days.map((day) => {
              const dayRes = getReservationsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
              const conflict = dayRes.length > 1 && hasConflict(dayRes);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSameDay(day, selectedDay!) ? null : day)}
                  className={[
                    "min-h-[100px] cursor-pointer p-2 transition",
                    !isCurrentMonth ? "opacity-30" : "",
                    isToday ? "bg-azul/10" : "bg-transparent hover:bg-white/[0.02]",
                    isSelected ? "ring-1 ring-azul/50" : ""
                  ].join(" ")}
                >
                  <div className={`text-xs font-medium ${isToday ? "text-azul-glow" : "text-mist"}`}>
                    {format(day, "d")}
                    {conflict && <span className="ml-1 text-red-400" title="Sobreposição de reservas">⚠</span>}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {dayRes.slice(0, 3).map((r) => {
                      const planName = r.plan?.name || "";
                      return (
                        <div
                          key={r.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedReservation(r); }}
                          className={`truncate rounded px-1 py-0.5 text-[10px] cursor-pointer ${getPlanColor(planName)} ${r.status === "CANCELADA" ? "opacity-40 line-through" : ""}`}
                        >
                          {format(new Date(r.startDatetime), "HH:mm")} {r.eventName}
                        </div>
                      );
                    })}
                    {dayRes.length > 3 && (
                      <div className="text-[10px] text-mist">+{dayRes.length - 3} mais</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected day detail */}
        {selectedDay && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="font-display font-bold text-paper capitalize">
              {format(selectedDay, "EEEE, d 'de' MMMM yyyy", { locale: pt })}
            </h3>
            {dayReservations.length === 0 ? (
              <p className="mt-3 text-sm text-mist">Sem reservas neste dia.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {dayReservations.map((r) => {
                  const planName = r.plan?.name || "—";
                  return (
                    <li
                      key={r.id}
                      className={`flex items-start justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4 ${r.status === "CANCELADA" ? "opacity-50" : ""}`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${getPlanColor(planName)}`}>
                            {planName}
                          </span>
                          {r.status === "CANCELADA" && (
                            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">Cancelada</span>
                          )}
                          {r.status === "PENDENTE_APROVACAO" && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">Pendente</span>
                          )}
                        </div>
                        <p className="mt-2 font-medium text-paper">{r.eventName}</p>
                        <p className="text-sm text-mist">
                          {format(new Date(r.startDatetime), "HH:mm")} – {format(new Date(r.endDatetime), "HH:mm")} · {r.totalHours.toFixed(1)}h · {r.responsible}
                        </p>
                        {r.companyName && <p className="text-xs text-mist">{r.companyName}</p>}
                        <p className="text-xs text-mist">{r.participants} participante(s)</p>
                        {r.coffeeBreak && <p className="text-xs text-amber-300">☕ Coffee Break</p>}
                      </div>
                      <button
                        onClick={() => setSelectedReservation(r)}
                        className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5"
                      >
                        Editar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </main>

      {selectedReservation && (
        <ReservationModal
          reservation={selectedReservation}
          plans={plans}
          onClose={() => setSelectedReservation(null)}
          onSaved={fetchData}
        />
      )}
      {creatingReservation && (
        <ReservationModal
          plans={plans}
          onClose={() => setCreatingReservation(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
