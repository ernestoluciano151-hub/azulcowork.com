"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";

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

type Props = {
  reservation?: Reservation | null;
  plans: MeetingPlan[];
  onClose: () => void;
  onSaved: () => void;
};

function toDateTimeLocal(dt: string) {
  return format(new Date(dt), "yyyy-MM-dd'T'HH:mm");
}

export default function ReservationModal({ reservation, plans, onClose, onSaved }: Props) {
  const isCreate = !reservation;

  const [eventName, setEventName] = useState(reservation?.eventName ?? "");
  const [companyName, setCompanyName] = useState(reservation?.companyName ?? "");
  const [responsible, setResponsible] = useState(reservation?.responsible ?? "");
  const [planId, setPlanId] = useState(reservation?.planId ?? (plans[0]?.id || ""));
  const [participants, setParticipants] = useState(String(reservation?.participants ?? "1"));
  const [startDatetime, setStartDatetime] = useState(
    reservation?.startDatetime ? toDateTimeLocal(reservation.startDatetime) : ""
  );
  const [endDatetime, setEndDatetime] = useState(
    reservation?.endDatetime ? toDateTimeLocal(reservation.endDatetime) : ""
  );
  const [coffeeBreak, setCoffeeBreak] = useState(reservation?.coffeeBreak ?? false);
  const [observations, setObservations] = useState(reservation?.observations ?? "");
  const [isCustomPricing, setIsCustomPricing] = useState(reservation?.isCustomPricing ?? false);
  const [customRequest, setCustomRequest] = useState(reservation?.customRequest ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const [conflictWarning, setConflictWarning] = useState("");

  const selectedPlan = plans.find(p => p.id === planId);
  const participantsNum = Number(participants) || 0;
  const participantsWarning = selectedPlan && participantsNum > selectedPlan.maxPeople
    ? `Atenção: excede a capacidade máxima do plano ${selectedPlan.name} (${selectedPlan.maxPeople} pessoas).`
    : "";

  // Calculate totalHours
  let totalHours = 0;
  if (startDatetime && endDatetime) {
    const diff = new Date(endDatetime).getTime() - new Date(startDatetime).getTime();
    if (diff > 0) totalHours = diff / 3600000;
  }

  const showCustomPricing = selectedPlan?.customPricingAllowed && totalHours >= (selectedPlan?.minHoursForCustom || 16);

  // Check for conflicts when times change
  useEffect(() => {
    if (!startDatetime || !endDatetime) return;
    const start = new Date(startDatetime);
    const end = new Date(endDatetime);
    if (end <= start) return;

    const params = new URLSearchParams({
      from: start.toISOString(),
      to: end.toISOString(),
      status: "CONFIRMADA"
    });

    fetch(`/api/reservations?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        const conflicts = (data.reservations || []).filter((r: Reservation) => {
          if (!isCreate && r.id === reservation?.id) return false;
          const rStart = new Date(r.startDatetime).getTime();
          const rEnd = new Date(r.endDatetime).getTime();
          return rStart < end.getTime() && rEnd > start.getTime();
        });
        setConflictWarning(conflicts.length > 0 ? "Aviso: existe sobreposição com outra reserva neste período." : "");
      })
      .catch(() => {});
  }, [startDatetime, endDatetime, isCreate, reservation?.id]);

  async function save() {
    setError("");
    if (!eventName || !responsible || !planId || !startDatetime || !endDatetime) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    const start = new Date(startDatetime);
    const end = new Date(endDatetime);
    if (end <= start) {
      setError("A hora de fim deve ser posterior à hora de início.");
      return;
    }
    if (selectedPlan?.customPricingAllowed && isCustomPricing && totalHours < (selectedPlan?.minHoursForCustom || 16)) {
      setError(`O plano Personalizado requer no mínimo ${selectedPlan.minHoursForCustom} horas.`);
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
            eventName, companyName: companyName || null, responsible, planId,
            participants: Number(participants),
            startDatetime: start.toISOString(),
            endDatetime: end.toISOString(),
            coffeeBreak, observations: observations || null,
            isCustomPricing, customRequest: customRequest || null
          })
        });
      } else {
        res = await fetch(`/api/reservations/${reservation!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName, companyName: companyName || null, responsible,
            participants: Number(participants),
            startDatetime: start.toISOString(),
            endDatetime: end.toISOString(),
            coffeeBreak, observations: observations || null,
            isCustomPricing, customRequest: customRequest || null
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

  async function doCancel() {
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
        {conflictWarning && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{conflictWarning}</p>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-mist">Nome do evento *</label>
            <input value={eventName} onChange={e => setEventName(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Empresa (opcional)</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Responsável *</label>
            <input value={responsible} onChange={e => setResponsible(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Plano *</label>
            <select value={planId} onChange={e => setPlanId(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper">
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name} (máx. {p.maxPeople} pessoas)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Participantes</label>
            <input type="number" value={participants} onChange={e => setParticipants(e.target.value)} min="1"
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
            {participantsWarning && (
              <p className="mt-1 text-xs text-amber-300">{participantsWarning}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-mist">Início *</label>
              <input type="datetime-local" value={startDatetime} onChange={e => setStartDatetime(e.target.value)}
                className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-mist">Fim *</label>
              <input type="datetime-local" value={endDatetime} onChange={e => setEndDatetime(e.target.value)}
                className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
            </div>
          </div>
          {totalHours > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-mist">
              Total: <span className="font-semibold text-paper">{totalHours.toFixed(2)} horas</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="coffeeBreak" checked={coffeeBreak} onChange={e => setCoffeeBreak(e.target.checked)}
              className="rounded border-white/20" />
            <label htmlFor="coffeeBreak" className="text-sm text-paper cursor-pointer">
              Coffee Break{" "}
              <span className="text-xs text-mist">— opcional, custos adicionais aplicáveis</span>
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs text-mist">Observações</label>
            <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper" />
          </div>
          {showCustomPricing && (
            <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isCustomPricing" checked={isCustomPricing} onChange={e => setIsCustomPricing(e.target.checked)}
                  className="rounded border-white/20" />
                <label htmlFor="isCustomPricing" className="text-sm text-amber-300 cursor-pointer font-medium">
                  Solicitar preço personalizado
                </label>
              </div>
              {isCustomPricing && (
                <div>
                  <label className="mb-1 block text-xs text-mist">Descrição do pedido</label>
                  <textarea value={customRequest} onChange={e => setCustomRequest(e.target.value)} rows={2}
                    placeholder="Descreva as necessidades especiais do evento..."
                    className="focus-ring w-full rounded-lg border border-amber-500/20 bg-ink px-3 py-2 text-sm text-paper" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          {!isCreate && !confirmCancel && (
            <button onClick={() => setConfirmCancel(true)}
              className="focus-ring rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10">
              Cancelar reserva
            </button>
          )}
          {!isCreate && confirmCancel && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-400">Confirmar?</span>
              <button onClick={doCancel} disabled={deleting}
                className="focus-ring rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-60">
                {deleting ? "..." : "Sim"}
              </button>
              <button onClick={() => setConfirmCancel(false)}
                className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-sm text-mist hover:bg-white/5">
                Não
              </button>
            </div>
          )}
          {isCreate && <div />}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="focus-ring rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5">
              Fechar
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
