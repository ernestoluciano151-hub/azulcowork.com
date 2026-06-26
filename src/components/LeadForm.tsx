"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
};

const initialState: FormState = { firstName: "", lastName: "", email: "", whatsapp: "" };

export default function LeadForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [showCalendar, setShowCalendar] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const formStartedAt = useRef<number>(Date.now());
  const honeypotRef = useRef<HTMLInputElement>(null);

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = "Indique o primeiro nome.";
    if (!form.lastName.trim()) next.lastName = "Indique o último nome.";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Indique um e-mail válido.";
    if (!form.whatsapp.trim() || form.whatsapp.replace(/\D/g, "").length < 9)
      next.whatsapp = "Indique um número de WhatsApp válido.";
    if (!date) next.date = "Escolha uma data para o agendamento.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduledDate: date!.toISOString(),
          formStartedAt: formStartedAt.current,
          honeypot: honeypotRef.current?.value || ""
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

  return (
    <section id="formulario" className="bg-ink py-16 md:py-24">
      <div className="mx-auto max-w-xl px-6">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-paper md:text-4xl">
            Agende a sua sessão estratégica
          </h2>
          <p className="mt-3 text-mist">
            Preencha os seus dados e escolha o melhor dia. Entraremos em contacto pelo WhatsApp
            para confirmar o horário.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-10 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8"
          noValidate
        >
          {/* Honeypot - invisível para humanos, capturado por bots */}
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

          <Field label="Contacto WhatsApp" error={errors.whatsapp}>
            <input
              type="tel"
              className={inputClass(!!errors.whatsapp)}
              value={form.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
              placeholder="+244 9XX XXX XXX"
              autoComplete="tel"
            />
          </Field>

          <Field label="Data para o agendamento" error={errors.date}>
            <button
              type="button"
              onClick={() => setShowCalendar((s) => !s)}
              className={inputClass(!!errors.date) + " flex items-center justify-between text-left"}
            >
              <span className={date ? "text-paper" : "text-mist"}>
                {date ? format(date, "PPP", { locale: ptBR }) : "Selecionar data no calendário"}
              </span>
              <span aria-hidden>📅</span>
            </button>

            {showCalendar && (
              <div className="mt-3 rounded-xl border border-white/10 bg-ink2 p-3">
                <DayPicker
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setShowCalendar(false);
                  }}
                  fromDate={new Date()}
                  locale={ptBR}
                />
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
