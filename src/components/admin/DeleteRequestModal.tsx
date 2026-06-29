"use client";

import { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityLabel: string;
  onSuccess: () => void;
}

export default function DeleteRequestModal({ isOpen, onClose, entityType, entityId, entityLabel, onSuccess }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError("A justificação é obrigatória."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/delete-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, entityLabel, reason }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => { onSuccess(); setSuccess(false); setReason(""); }, 2000);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Erro ao enviar pedido.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setReason(""); setError(""); setSuccess(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink2 p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-xl">
            ⚠️
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold text-paper">Pedido de eliminação</h2>
            <p className="mt-1 text-sm text-mist">
              Solicitar eliminação de: <span className="font-medium text-paper">{entityLabel}</span>
            </p>
          </div>
          <button onClick={handleClose} className="text-mist hover:text-paper text-xl leading-none">✕</button>
        </div>

        {success ? (
          <div className="mt-6 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            ✅ O seu pedido foi enviado ao administrador para validação.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-paper">
                Justificação <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Indique o motivo da eliminação..."
                className="w-full rounded-lg border border-white/10 bg-ink px-4 py-3 text-sm text-paper placeholder:text-mist/50 focus:outline-none focus:ring-2 focus:ring-azul resize-none"
                required
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-mist hover:text-paper"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {loading ? "A enviar..." : "Enviar pedido"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
