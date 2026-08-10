"use client";

/**
 * /portal/reservas/nova — Formulário de nova reserva de sala (VOL09)
 *
 * Consome:
 *   GET /api/portal/rooms/availability?date=YYYY-MM-DD
 *   POST /api/portal/bookings
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/portal/PortalLayout";
import Link from "next/link";
import { roundBillableHours, ROOM_HOURLY_RATE_KZ } from "@/lib/pricing-service";

interface Room {
  id:               string;
  name:             string;
  maxPeople:        number;
  pricePerHour:     number;
  coffeeBreakPrice: number;
  description:      string | null;
  bookedSlots: { from: string; to: string; status: string }[];
}

function fmtKz(n: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency", currency: "AOA", minimumFractionDigits: 2,
  }).format(n);
}

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}

function todayMin() {
  return toDateString(new Date());
}

function NovaReservaContent() {
  const router    = useRouter();
  const [date,    setDate]    = useState(todayMin());
  const [rooms,   setRooms]   = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoom,  setSelectedRoom]  = useState<string>("");
  const [startTime,     setStartTime]     = useState("09:00");
  const [endTime,       setEndTime]       = useState("11:00");
  const [attendees,     setAttendees]     = useState(2);
  const [coffeeBreak,   setCoffeeBreak]   = useState(false);
  const [notes,         setNotes]         = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    if (!date) return;
    setLoadingRooms(true);
    try {
      const res  = await fetch(`/api/portal/rooms/availability?date=${date}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar salas.");
      setRooms(json.data ?? []);
      setSelectedRoom("");
    } catch {
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }, [date]);

  useEffect(() => { void loadRooms(); }, [loadRooms]);

  const room         = rooms.find(r => r.id === selectedRoom);
  const durationMinutes = room ? (() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    return Math.max(0, eh * 60 + em - sh * 60 - sm);
  })() : 0;
  const durationHrs  = durationMinutes / 60;
  // Mesma regra do painel admin (roundBillableHours): cobrança por hora
  // completa, com tolerância de 30 min — evita mostrar uma estimativa
  // fraccionada que depois não bate certo com o valor realmente cobrado
  // pelo servidor (ver POST /api/portal/bookings).
  const hourlyRate      = room && room.pricePerHour > 0 ? room.pricePerHour : ROOM_HOURLY_RATE_KZ;
  const estimatedPrice = room && durationMinutes > 0
    ? hourlyRate * roundBillableHours(durationMinutes) + (coffeeBreak ? room.coffeeBreakPrice : 0)
    : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedRoom || !date || !startTime || !endTime) {
      setError("Por favor preencha todos os campos obrigatórios.");
      return;
    }
    if (durationHrs <= 0) {
      setError("A hora de fim deve ser posterior à hora de início.");
      return;
    }
    if (attendees < 1) {
      setError("Indique pelo menos 1 participante.");
      return;
    }
    setSubmitting(true);
    try {
      const res  = await fetch("/api/portal/bookings", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          planId:        selectedRoom,
          startDatetime: `${date}T${startTime}:00`,
          endDatetime:   `${date}T${endTime}:00`,
          attendees,
          coffeeBreak,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao criar reserva. Tente novamente.");
        return;
      }
      router.push("/portal/reservas");
    } catch {
      setError("Sem ligação ao servidor. Verifique a sua internet.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/portal/reservas" className="text-sm text-gray-400 hover:text-gray-600">
          ← Reservas
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Nova Reserva</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Data */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">1. Seleccionar Data e Sala</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Data</label>
            <input
              type="date"
              required
              min={todayMin()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {loadingRooms ? (
            <div className="text-sm text-gray-400">A carregar salas disponíveis...</div>
          ) : rooms.length === 0 ? (
            <div className="text-sm text-amber-600">Nenhuma sala disponível para esta data.</div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sala de Reunião
              </label>
              {rooms.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedRoom === r.id
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="room"
                    value={r.id}
                    checked={selectedRoom === r.id}
                    onChange={() => setSelectedRoom(r.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{r.name}</span>
                      <span className="text-sm text-blue-600 font-medium">
                        {fmtKz(r.pricePerHour)}/hora
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Até {r.maxPeople} pessoas
                      {r.description ? ` · ${r.description}` : ""}
                    </div>
                    {r.bookedSlots.length > 0 && (
                      <div className="text-xs text-amber-600 mt-1">
                        ⚠ Ocupada em:{" "}
                        {r.bookedSlots.map(s =>
                          `${new Date(s.from).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}–${new Date(s.to).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}`
                        ).join(", ")}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Horário */}
        {selectedRoom && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">2. Horário</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Hora de início</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  min="08:00"
                  max="18:00"
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Hora de fim</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  min="08:00"
                  max="20:00"
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            {durationHrs > 0 && (
              <div className="text-xs text-gray-500">
                Duração: {durationHrs.toFixed(1)} hora{durationHrs !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}

        {/* Detalhes */}
        {selectedRoom && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">3. Detalhes</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nº de participantes
              </label>
              <input
                type="number"
                required
                min={1}
                max={room?.maxPeople ?? 50}
                value={attendees}
                onChange={(e) => setAttendees(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {room && room.coffeeBreakPrice > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={coffeeBreak}
                  onChange={(e) => setCoffeeBreak(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  Coffee break (+{fmtKz(room.coffeeBreakPrice)})
                </span>
              </label>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Observações (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Requisitos especiais, equipamentos, etc."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>
          </div>
        )}

        {/* Resumo + Submeter */}
        {selectedRoom && durationHrs > 0 && (
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
            <div className="font-semibold text-blue-800 mb-2">Resumo</div>
            <div className="text-sm text-blue-700 space-y-1">
              <div>{room?.name} · {date} · {startTime}–{endTime}</div>
              <div>{attendees} participante{attendees !== 1 ? "s" : ""}</div>
              <div className="font-bold text-base mt-2">
                Estimativa: {fmtKz(estimatedPrice)}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {selectedRoom && (
          <button
            type="submit"
            disabled={submitting || !selectedRoom || durationHrs <= 0}
            className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "A enviar pedido..." : "Solicitar Reserva"}
          </button>
        )}
      </form>
    </div>
  );
}

export default function PortalNovaReservaPage() {
  return (
    <PortalLayout>
      <NovaReservaContent />
    </PortalLayout>
  );
}
