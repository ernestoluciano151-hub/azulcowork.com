"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/admin/Sidebar";
import RoomModal, { Room } from "@/components/admin/RoomModal";
import ReservationModal, { Reservation } from "@/components/admin/ReservationModal";
import { format } from "date-fns";

const ROOM_COLORS = [
  "bg-azul/15 text-azul-glow border-azul/30",
  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "bg-purple-500/15 text-purple-300 border-purple-500/30",
  "bg-amber-500/15 text-amber-300 border-amber-500/30"
];

export default function SalasPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [creatingReservation, setCreatingReservation] = useState(false);
  const [defaultRoomId, setDefaultRoomId] = useState<string>("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [roomsRes, resRes, compRes] = await Promise.all([
      fetch("/api/rooms"),
      fetch("/api/reservations?from=" + new Date().toISOString()),
      fetch("/api/companies")
    ]);
    if (roomsRes.ok) {
      const d = await roomsRes.json();
      setRooms(d.rooms);
    }
    if (resRes.ok) {
      const d = await resRes.json();
      setReservations(d.reservations);
    }
    if (compRes.ok) {
      const d = await compRes.json();
      setCompanies(d.companies.map((c: any) => ({ id: c.id, name: c.name })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openNewReservation(roomId?: string) {
    setDefaultRoomId(roomId || "");
    setCreatingReservation(true);
  }

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-paper">Salas de Reunião</h1>
            <p className="mt-1 text-sm text-mist">{rooms.length} sala(s) registadas.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openNewReservation()}
              className="focus-ring rounded-lg border border-azul/40 bg-azul/10 px-4 py-2 text-sm font-medium text-azul-glow hover:bg-azul/20"
            >
              + Nova Reserva
            </button>
            <button
              onClick={() => setCreatingRoom(true)}
              className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-medium text-white hover:bg-azul-dim"
            >
              + Nova Sala
            </button>
          </div>
        </div>

        {/* Salas grid */}
        {loading ? (
          <p className="mt-8 text-center text-mist">A carregar...</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room, idx) => (
              <div
                key={room.id}
                className={`rounded-2xl border bg-white/[0.03] p-5 ${ROOM_COLORS[idx % ROOM_COLORS.length].split(" ")[2]}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-bold text-paper">{room.name}</h3>
                    <p className="mt-1 text-xs text-mist">Capacidade: {room.capacity} pessoas</p>
                    {room.description && <p className="mt-1 text-xs text-mist">{room.description}</p>}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    room.status === "DISPONIVEL" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                  }`}>
                    {room.status === "DISPONIVEL" ? "Disponível" : "Manutenção"}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => openNewReservation(room.id)}
                    className="focus-ring flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-paper hover:bg-white/5"
                  >
                    Reservar
                  </button>
                  <button
                    onClick={() => setEditingRoom(room)}
                    className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs text-mist hover:bg-white/5"
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Próximas reservas */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-display text-lg font-bold text-paper">Próximas Reservas</h2>
          {reservations.length === 0 ? (
            <p className="mt-3 text-sm text-mist">Sem reservas futuras.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-mist">
                  <tr>
                    <th className="pb-3 font-medium">Sala</th>
                    <th className="pb-3 font-medium">Evento</th>
                    <th className="pb-3 font-medium">Responsável</th>
                    <th className="pb-3 font-medium">Início</th>
                    <th className="pb-3 font-medium">Fim</th>
                    <th className="pb-3 font-medium">Part.</th>
                    <th className="pb-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reservations.map((r) => (
                    <tr key={r.id} className="text-paper">
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${ROOM_COLORS[(rooms.findIndex(rm => rm.id === r.roomId)) % ROOM_COLORS.length].split(" ").slice(0, 2).join(" ")}`}>
                          {r.room?.name || "—"}
                        </span>
                      </td>
                      <td className="py-3">{r.eventName}</td>
                      <td className="py-3 text-mist">{r.responsible}</td>
                      <td className="py-3 text-mist">{format(new Date(r.startDatetime), "dd/MM HH:mm")}</td>
                      <td className="py-3 text-mist">{format(new Date(r.endDatetime), "HH:mm")}</td>
                      <td className="py-3 text-mist">{r.participants}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setEditingReservation(r)}
                          className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {(editingRoom) && (
        <RoomModal room={editingRoom} onClose={() => setEditingRoom(null)} onSaved={fetchAll} />
      )}
      {creatingRoom && (
        <RoomModal onClose={() => setCreatingRoom(false)} onSaved={fetchAll} />
      )}
      {(editingReservation) && (
        <ReservationModal
          reservation={editingReservation}
          rooms={rooms}
          companies={companies}
          onClose={() => setEditingReservation(null)}
          onSaved={fetchAll}
        />
      )}
      {creatingReservation && (
        <ReservationModal
          rooms={rooms}
          companies={companies}
          defaultRoomId={defaultRoomId}
          onClose={() => setCreatingReservation(false)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}
