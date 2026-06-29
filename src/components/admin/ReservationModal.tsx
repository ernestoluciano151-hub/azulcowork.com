"use client";

import { useState } from "react";
import { format } from "date-fns";

export type Reservation = {
  id: string;
  roomId: string;
  companyId?: string | null;
  eventName: string;
  responsible: string;
  startDatetime: string;
  endDatetime: string;
  participants: number;
  notes?: string | null;
  status: string;
  room?: { id: string; name: string };
  company?: { id: string; name: string } | null;
};

export type RoomOption = { id: string; name: string; capacity: number };
export type CompanyOption = { id: string; name: string };

type Props = {
  reservation?: Reservation | null;
  rooms: RoomOption[];
  companies: CompanyOption[];
  defaultRoomId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function ReservationModal({ reservation, rooms, companies, defaultRoomId, onClose, onSaved }: Props) {
  const isCreate = !reservation;

  function toDateTimeLocal(dt: string) {
    return format(new Date(dt), "yyyy-MM-dd'T'HH:mm");
  }

  const [roomId, setRoomId] = useState(reservation?.roomId ?? defaultRoomId ?? (rooms[0]?.id || ""));
  const [companyId, setCompanyId] = useState(reservation?.companyId ?? "");
  const [eventName, setEventName] = useState(reservation?.eventName ?? "");
  const [responsible, setResponsible] = useState(reservation?.responsible ?? "");
  const [startDatetime, setStartDatetime] = useState(
    reservation?.startDatetime ? toDateTimeLocal(reservation.startDatetime) : ""
  );
  const [endDatetime, setEndDatetime] = useState(
    reservation?.endDatetime ? toDateTimeLocal(reservation.endDatetime) : ""
  );
  const [participants, setParticipants] = useState(String(reservation?.participants ?? "1"));
  const [notes, setNotes] = useState(reservation?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!roomId || !eventName || !responsible || !startDatetime || !endDatetime) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    const start = new Date(startDatetime);
    const end = new Date(endDatetime);
    if (end <= start) {
      setError("A hora de fim deve ser posterior à hora de início.");
      return;
    }
    setSaving(true);
    try {
      let res: Response;
      if (isCreate) {
        res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            companyId: companyId || null,
            eventName, responsible,
            startDatetime: start.toISOString(),
            endDatetime: end.toISOString(),
            participants: Number(participants),
            notes: notes || null
          })
        });
      } else {
        res = await fetch(`/api/reservations/${reservation!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: companyId || null,
            eventName, responsible,
            startDatetime: start.toISOString(),
            endDatetime: end.toISOString(),
            participants: Number(participants),
            notes: notes || null
          })
        });
      }
      const data = await res.json();
      if (res.ok) { onSaved(); onClose(); }
      else setError(data.error || "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/reservations/${reservation!.id}`, { method: "DELETE" });
      onSaved(); onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink2 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-lg font-bold text-paper">
          {isCreate ? "Nova Reserva" : "Editar Reserva"}
        </h2>
        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-mist">Sala *</label>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)}
              disabled={!isCreate}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper disabled:opacity-60">
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} (cap. {r.capacity})</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Empresa (opcional)</label>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper">
              <option value="">— Sem empresa —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Nome do evento *</label>
            <input value={eventName} onChange={(e) => setEventName(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Responsável *</label>
            <input value={responsible} onChange={(e) => setResponsible(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-mist">Início *</label>
              <input type="datetime-local" value={startDatetime} onChange={(e) => setStartDatetime(e.target.value)}
                className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-mist">Fim *</label>
              <input type="datetime-local" value={endDatetime} onChange={(e) => setEndDatetime(e.target.value)}
                className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Participantes</label>
            <input type="number" value={participants} onChange={(e) => setParticipants(e.target.value)} min="1"
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          {!isCreate && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)}
              className="focus-ring rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10">
              Cancelar reserva
            </button>
          )}
          {!isCreate && confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-400">Confirmar?</span>
              <button onClick={doDelete} disabled={deleting}
                className="focus-ring rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-60">
                {deleting ? "..." : "Sim"}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-sm text-mist hover:bg-white/5">
                Não
              </button>
            </div>
          )}
          {isCreate && <div />}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="focus-ring rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5">
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-60">
              {saving ? "A guardar..." : isCreate ? "Reservar" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
