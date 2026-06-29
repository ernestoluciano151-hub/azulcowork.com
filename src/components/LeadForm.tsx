"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getDialInfoFromTimezone, type DialInfo } from "@/lib/countryCode";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  whatsappNumber: string; // só o número, sem código
  spaceType: string;
  planName: string;
};

const initialState: FormState = { firstName: "", lastName: "", email: "", whatsappNumber: "", spaceType: "", planName: "" };

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08h às 20h
const MINUTES = ["00", "15", "30", "45"];

export default function LeadForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [dialInfo, setDialInfo] = useState<DialInfo>({ code: "+244", flag: "🇦🇴", name: "Angola" });
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [hour, setHour] = useState<string>("09");
  const [minute, setMinute] = useState<string>("00");
  const [showCalendar, setShowCalendar] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const formStartedAt = useRef<number>(Date.now());
  const honeypotRef = useRef<HTMLInputElement>(null);

  // Detecta fuso horário e define código de país automaticamente
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setDialInfo(getDialInfoFromTimezone(tz));
    } catch {
      // mantém o padrão (+244)
    }
  }, []);

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function getScheduledDateTime(): Date | null {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(Number(hour), Number(minute), 0, 0);
    return d;
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = "Indique o primeiro nome.";
    if (!form.lastName.trim()) next.lastName = "Indique o último nome.";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Indique um e-mail válido.";
    const fullNumber = form.whatsappNumber.replace(/\D/g, "");
    if (!fullNumber || fullNumber.length < 7)
      next.whatsapp = "Indique um número de WhatsApp válido.";
    if (!date) next.date = "Escolha uma data e hora para o agendamento.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    const scheduledDateTime = getScheduledDateTime();
    const fullWhatsapp = `${dialInfo.code} ${form.whatsappNumber.trim()}`;

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          whatsapp: fullWhatsapp,
          scheduledDate: scheduledDateTime!.toISOString(),
          formStartedAt: formStartedAt.current,
          honeypot: honeypotRef.current?.value || "",
          spaceType: form.spaceType || undefined,
          planName: form.planName || undefined,
        })
      });

      if (res.status === 429) {
        setServerError("Demasiadas tentativas. Tente novamente dentro de alguns minutos.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerError(data?.error || "Não foi possível enviar. Tente novamente.");
        return;
      }
      router.push("/obrigado");
    } catch {
      setServerError("Erro de ligação. Verifique a internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const scheduledDateTime = getScheduledDateTime();

  return (
    <section id="formulario" className="bg-ink py-16 md:py-24">
      <div className="mx-auto max-w-xl px-6">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-paper md:text-4xl">
            Agende a sua sessão estratégica
          </h2>
          <p className="mt-3 text-mist">
            Preencha os seus dados e escolha o melhor dia e hora. Entraremos em contacto pelo
            WhatsApp para confirmar.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-10 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8"
          noValidate
        >
          {/* Honeypot */}
          <input
            ref={honeypotRef}
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Primeiro nome" error={errors.firstName}>
              <input
                className={inputClass(!!errors.firstName)}
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                placeholder="Ex: Ernesto"
                autoComplete="given-name"
              />
            </Field>

            <Field label="Último nome" error={errors.lastName}>
              <input
                className={inputClass(!!errors.lastName)}
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                placeholder="Ex: Luciano"
                autoComplete="family-name"
              />
            </Field>
          </div>

          <Field label="E-mail" error={errors.email}>
            <input
              type="email"
              className={inputClass(!!errors.email)}
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="nome@email.com"
              autoComplete="email"
            />
          </Field>

          {/* WhatsApp com código de país automático */}
          <Field label="Contacto WhatsApp" error={errors.whatsapp}>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink2 px-3 py-3 text-sm text-paper whitespace-nowrap">
                <span>{dialInfo.flag}</span>
                <span className="font-medium">{dialInfo.code}</span>
              </div>
              <input
                type="tel"
                className={inputClass(!!errors.whatsapp) + " flex-1"}
                value={form.whatsappNumber}
                onChange={(e) => update("whatsappNumber", e.target.value)}
                placeholder="9XX XXX XXX"
                autoComplete="tel"
              />
            </div>
            <p className="mt-1 text-xs text-mist/60">
              Detectado: {dialInfo.flag} {dialInfo.name}
            </p>
          </Field>

          {/* Tipo de espaço */}
          <Field label="Tipo de espaço">
            <select
              className={inputClass(false)}
              value={form.spaceType}
              onChange={(e) => update("spaceType", e.target.value)}
            >
              <option value="">Selecionar (opcional)</option>
              <option value="Hot Desk">Hot Desk</option>
              <option value="Mesa Fixa">Mesa Fixa</option>
              <option value="Sala Privada">Sala Privada</option>
              <option value="Sala de Reunião">Sala de Reunião</option>
              <option value="Outro">Outro</option>
            </select>
          </Field>

          {/* Plano de interesse */}
          <Field label="Plano de interesse">
            <input
              className={inputClass(false)}
              value={form.planName}
              onChange={(e) => update("planName", e.target.value)}
              placeholder="Ex: Mesa Fixa — 79.900 AOA/mês (opcional)"
            />
          </Field>

          {/* Data + Hora */}
          <Field label="Data e hora do agendamento" error={errors.date}>
            <button
              type="button"
              onClick={() => setShowCalendar((s) => !s)}
              className={inputClass(!!errors.date) + " flex items-center justify-between text-left"}
            >
              <span className={scheduledDateTime ? "text-paper" : "text-mist"}>
                {scheduledDateTime
                  ? format(scheduledDateTime, "PPP 'às' HH:mm", { locale: ptBR })
                  : "Selecionar data e hora"}
              </span>
              <span aria-hidden>📅</span>
            </button>

            {showCalendar && (
              <div className="mt-3 rounded-xl border border-white/10 bg-ink2 p-4">
                <DayPicker
                  mode="single"
                  selected={date}
                  onSelect={(d) => setDate(d)}
                  fromDate={new Date()}
                  locale={ptBR}
                />

                {/* Seletor de hora */}
                {date && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="mb-2 text-xs font-medium text-mist">Escolha a hora</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={hour}
                        onChange={(e) => setHour(e.target.value)}
                        className="focus-ring flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={String(h).padStart(2, "0")}>
                            {String(h).padStart(2, "0")}h
                          </option>
                        ))}
                      </select>
                      <span className="text-mist font-bold">:</span>
                      <select
                        value={minute}
                        onChange={(e) => setMinute(e.target.value)}
                        className="focus-ring flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
                      >
                        {MINUTES.map((m) => (
                          <option key={m} value={m}>
                            {m} min
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCalendar(false)}
                        className="rounded-lg bg-azul px-4 py-2 text-xs font-semibold text-white hover:bg-azul-dim"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Field>

          {serverError && (
            <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="focus-ring w-full rounded-xl bg-azul px-6 py-4 text-sm font-semibold text-white shadow-glow transition hover:bg-azul-dim disabled:cursor-not-allowed disabled:opacity-60 md:text-base"
          >
            {submitting ? "A enviar..." : "Quero Agendar"}
          </button>

          <p className="text-center text-xs text-mist">
            Ao enviar, aceita ser contactado pela nossa equipa. Os seus dados não serão partilhados.
          </p>
        </form>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-paper">{label}</label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return [
    "focus-ring w-full rounded-lg border bg-ink2 px-4 py-3 text-sm text-paper placeholder:text-mist/60",
    hasError ? "border-red-400/60" : "border-white/10"
  ].join(" ");
}
