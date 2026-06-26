"use client";

import { useState } from "react";
import { format } from "date-fns";

const STATUSES = [
  { value: "NOVO", label: "Novo" },
  { value: "CONTACTADO", label: "Contactado" },
  { value: "EM_NEGOCIACAO", label: "Em negociação" },
  { value: "CONVERTIDO", label: "Convertido" },
  { value: "PERDIDO", label: "Perdido" }
];

export type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  scheduledDate: string;
  status: string;
  createdAt: string;
  notes: { id: string; content: string; createdAt: string }[];
};

export default function LeadModal({
  lead,
  onClose,
  onSaved
}: {
  lead: Lead;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
}) {
  const [firstName, setFirstName] = useState(lead.firstName);
  const [lastName, setLastName] = useState(lead.lastName);
  const [email, setEmail] = useState(lead.email);
  const [whatsapp, setWhatsapp] = useState(lead.whatsapp);
  const [status, setStatus] = useState(lead.status);
  const [scheduledDate, setScheduledDate] = useState(
    format(new Date(lead.scheduledDate), "yyyy-MM-dd")
  );
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          whatsapp,
          status,
          scheduledDate: new Date(scheduledDate).toISOString(),
          newNote: newNote.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSaved(data.lead);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink2 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-lg font-bold text-paper">Editar lead</h2>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Input label="Primeiro nome" value={firstName} onChange={setFirstName} />
          <Input label="Último nome" value={lastName} onChange={setLastName} />
        </div>
        <div className="mt-3">
          <Input label="E-mail" value={email} onChange={setEmail} />
        </div>
        <div className="mt-3">
          <Input label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-mist">Data agendada</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-1 block text-xs text-mist">Notas internas</label>
          <div className="max-h-32 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-ink p-3">
            {lead.notes.length === 0 && <p className="text-xs text-mist">Sem notas ainda.</p>}
            {lead.notes.map((n) => (
              <div key={n.id} className="text-xs text-mist">
                <span className="text-paper">{n.content}</span>
                <div className="text-[10px]">{format(new Date(n.createdAt), "Pp")}</div>
              </div>
            ))}
          </div>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Adicionar nova nota..."
            className="focus-ring mt-2 w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
            rows={2}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="focus-ring rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-60"
          >
            {saving ? "A guardar..." : "Guardar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-mist">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
      />
    </div>
  );
}
