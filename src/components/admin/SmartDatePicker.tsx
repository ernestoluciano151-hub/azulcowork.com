"use client";

/**
 * SmartDatePicker — substituto do <input type="date"> nativo.
 *
 * Problema resolvido: o input nativo permite digitar segmento-a-segmento
 * (dia/mês/ano) sem qualquer validação ou limite, produzindo datas
 * corrompidas como "13/04/0266" (ano com 3 dígitos, por exemplo). Este
 * componente:
 *
 *   1. Mascara a digitação em DD/MM/AAAA, avançando automaticamente entre
 *      segmentos e limitando cada um ao intervalo válido (dia 1–31,
 *      mês 1–12, ano 4 dígitos dentro de MIN_YEAR–MAX_YEAR);
 *   2. Valida a data completa (ex.: 31/02 não existe) ao perder o foco,
 *      revertendo para o último valor válido em caso de erro;
 *   3. Oferece um calendário visual (grelha mês-a-mês) como alternativa
 *      à digitação, para selecção sem risco de erro de digitação.
 *
 * Interface pública: value/onChange usam sempre o formato ISO "yyyy-MM-dd"
 * (o mesmo que o input nativo produzia) — zero alterações a APIs, ao
 * schema ou ao formato de payload enviado ao backend.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  format,
  parse,
  isValid,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import { pt } from "date-fns/locale";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const d = parse(iso, "yyyy-MM-dd", new Date());
  if (!isValid(d)) return "";
  return format(d, "dd/MM/yyyy");
}

function displayToIso(display: string): string | null {
  const d = parse(display, "dd/MM/yyyy", new Date());
  if (!isValid(d)) return null;
  if (d.getFullYear() < MIN_YEAR || d.getFullYear() > MAX_YEAR) return null;
  return format(d, "yyyy-MM-dd");
}

/** Aplica a máscara DD/MM/AAAA a uma sequência de dígitos digitados, clampando cada segmento. */
function maskDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let day = digits.slice(0, 2);
  let month = digits.slice(2, 4);
  let year = digits.slice(4, 8);

  if (day.length === 2) {
    const n = Math.min(31, Math.max(1, parseInt(day, 10) || 1));
    day = String(n).padStart(2, "0");
  }
  if (month.length === 2) {
    const n = Math.min(12, Math.max(1, parseInt(month, 10) || 1));
    month = String(n).padStart(2, "0");
  }

  let out = day;
  if (digits.length > 2) out += "/" + month;
  if (digits.length > 4) out += "/" + year;
  return out;
}

interface SmartDatePickerProps {
  value: string; // ISO "yyyy-MM-dd" ou ""
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  min?: string; // ISO
  max?: string; // ISO
  className?: string;
}

export default function SmartDatePicker({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  required,
  min,
  max,
  className = "",
}: SmartDatePickerProps) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const [open, setOpen] = useState(false);
  const [cursorMonth, setCursorMonth] = useState(() => {
    const d = value ? parse(value, "yyyy-MM-dd", new Date()) : new Date();
    return isValid(d) ? d : new Date();
  });
  const [invalid, setInvalid] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sincroniza texto exibido quando o valor externo muda (ex.: reset do form)
  useEffect(() => {
    setText(isoToDisplay(value));
    setInvalid(false);
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function commitText(raw: string) {
    if (raw.trim() === "") {
      onChange("");
      setInvalid(false);
      return;
    }
    const iso = displayToIso(raw);
    if (iso) {
      if ((min && iso < min) || (max && iso > max)) {
        setInvalid(true);
        return;
      }
      onChange(iso);
      setInvalid(false);
    } else {
      setInvalid(true);
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskDigits(e.target.value);
    setText(masked);
    setInvalid(false);
    if (masked.length === 10) commitText(masked);
  }

  function handleBlur() {
    if (text.length > 0 && text.length < 10) {
      // incompleto → reverte para o último valor válido
      setText(isoToDisplay(value));
      setInvalid(false);
      return;
    }
    commitText(text);
  }

  function pickDay(d: Date) {
    const iso = format(d, "yyyy-MM-dd");
    if ((min && iso < min) || (max && iso > max)) return;
    onChange(iso);
    setText(format(d, "dd/MM/yyyy"));
    setInvalid(false);
    setOpen(false);
  }

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursorMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursorMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursorMonth]);

  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : null;

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex w-full items-center gap-2 rounded-lg border bg-[#101a2e] px-3 py-2 text-sm text-[#F5F7FA] focus-within:ring-1 focus-within:ring-[#2F6FED] ${
          invalid ? "border-red-500/60" : "border-white/10"
        } ${className}`}
      >
        <input
          type="text"
          inputMode="numeric"
          value={text}
          placeholder={placeholder}
          required={required}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onFocus={() => setOpen(true)}
          className="w-full bg-transparent outline-none placeholder:text-[#4B5875]"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 text-[#94A3B8] hover:text-[#F5F7FA]"
          tabIndex={-1}
          aria-label="Abrir calendário"
        >
          📅
        </button>
      </div>
      {invalid && (
        <p className="mt-1 text-xs text-red-400">Data inválida — use dd/mm/aaaa.</p>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-xl border border-white/10 bg-[#101a2e] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursorMonth((m) => subMonths(m, 1))}
              className="rounded p-1 text-[#94A3B8] hover:bg-white/5 hover:text-[#F5F7FA]"
            >
              ‹
            </button>
            <span className="text-sm font-medium capitalize text-[#F5F7FA]">
              {format(cursorMonth, "MMMM yyyy", { locale: pt })}
            </span>
            <button
              type="button"
              onClick={() => setCursorMonth((m) => addMonths(m, 1))}
              className="rounded p-1 text-[#94A3B8] hover:bg-white/5 hover:text-[#F5F7FA]"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#4B5875]">
            {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const disabled = Boolean(
                (min && format(d, "yyyy-MM-dd") < min) ||
                (max && format(d, "yyyy-MM-dd") > max)
              );
              const selected = selectedDate && isSameDay(d, selectedDate);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(d)}
                  className={`rounded-md py-1 text-xs transition-colors ${
                    disabled
                      ? "cursor-not-allowed text-[#2b3650]"
                      : selected
                      ? "bg-[#2F6FED] text-white"
                      : isSameMonth(d, cursorMonth)
                      ? "text-[#F5F7FA] hover:bg-white/10"
                      : "text-[#4B5875] hover:bg-white/5"
                  } ${isToday(d) && !selected ? "ring-1 ring-[#2F6FED]/50" : ""}`}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={() => pickDay(new Date())}
              className="text-xs text-[#2F6FED] hover:underline"
            >
              Hoje
            </button>
            {!required && (
              <button
                type="button"
                onClick={() => { onChange(""); setText(""); setOpen(false); }}
                className="text-xs text-[#94A3B8] hover:text-[#F5F7FA]"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
