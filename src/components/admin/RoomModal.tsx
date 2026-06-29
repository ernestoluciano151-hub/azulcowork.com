"use client";

import { useState } from "react";

export type Room = {
  id: string;
  name: string;
  capacity: number;
  status: string;
  description?: string | null;
  createdAt: string;
};

type Props = {
  room?: Room | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function RoomModal({ room, onClose, onSaved }: Props) {
  const isCreate = !room;
  const [name, setName] = useState(room?.name ?? "");
  const [capacity, setCapacity] = useState(String(room?.capacity ?? ""));
  const [status, setStatus] = useState(room?.status ?? "DISPONIVEL");
  const [description, setDescription] = useState(room?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!name || !capacity) {
      setError("Nome e capacidade são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const url = isCreate ? "/api/rooms" : `/api/rooms/${room!.id}`;
      const method = isCreate ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, capacity: Number(capacity), status, description: description || null })
      });
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
      await fetch(`/api/rooms/${room!.id}`, { method: "DELETE" });
      onSaved(); onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink2 p-6">
        <h2 className="font-display text-lg font-bold text-paper">
          {isCreate ? "Nova Sala" : "Editar Sala"}
        </h2>
        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-mist">Nome da sala *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-mist">Capacidade *</label>
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)}
                className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-mist">Estado</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper">
                <option value="DISPONIVEL">Disponível</option>
                <option value="MANUTENCAO">Manutenção</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" rows={2} />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          {!isCreate && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)}
              className="focus-ring rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10">
              Eliminar
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
              {saving ? "A guardar..." : isCreate ? "Criar" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
