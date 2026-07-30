/**
 * plan-validators.ts
 *
 * Validadores puros para MeetingPlan e RoomSettings.
 * Sem dependências externas — testáveis com node -e.
 *
 * VOL04-3 — 29 Julho 2026
 */

// ── MeetingPlan ───────────────────────────────────────────────────────────────

const PRICE_FIELDS = [
  "pricePerHour",
  "coffeeBreakPrice",
  "halfDayPrice",
  "fullDayPrice",
  "weekendPrice",
  "promoPrice",
] as const;

/**
 * Valida que os campos de preço não são negativos.
 * Campos ausentes são ignorados.
 */
export function validatePlanPrices(
  body: Record<string, unknown>
): { error: string } | null {
  for (const field of PRICE_FIELDS) {
    if (body[field] !== undefined && Number(body[field]) < 0) {
      return { error: "Preços não podem ser negativos." };
    }
  }
  return null;
}

/**
 * Valida que maxPeople é ≥ 1.
 */
export function validateMaxPeople(
  value: unknown
): { error: string } | null {
  if (value === undefined || value === null || Number(value) < 1) {
    return { error: "Capacidade máxima deve ser ≥ 1." };
  }
  return null;
}

// ── RoomSettings ──────────────────────────────────────────────────────────────

/**
 * Converte "HH:MM" em minutos desde meia-noite.
 * Retorna null se o formato for inválido.
 */
export function parseTime(t: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Valida o body de PUT /api/admin/room-settings.
 *
 * Regras:
 *   - openTime e closeTime, quando ambos presentes: openTime < closeTime
 *   - Cada um individualmente, se presente: deve respeitar HH:MM e ser hora válida
 *   - minHours: ≥ 1
 *   - maxHours: ≥ 1 e > minHours quando ambos presentes
 *   - maxDiscount: entre 0 e 100
 */
export function validateRoomSettings(
  body: Record<string, unknown>
): { error: string } | null {
  // openTime / closeTime
  if (body.openTime !== undefined) {
    if (parseTime(String(body.openTime)) === null) {
      return { error: "'openTime' inválido. Formato esperado: HH:MM." };
    }
  }
  if (body.closeTime !== undefined) {
    if (parseTime(String(body.closeTime)) === null) {
      return { error: "'closeTime' inválido. Formato esperado: HH:MM." };
    }
  }
  if (body.openTime !== undefined && body.closeTime !== undefined) {
    const o = parseTime(String(body.openTime))!;
    const c = parseTime(String(body.closeTime))!;
    if (o >= c) {
      return { error: "'openTime' deve ser anterior a 'closeTime'." };
    }
  }

  // minHours
  if (body.minHours !== undefined && Number(body.minHours) < 1) {
    return { error: "'minHours' deve ser ≥ 1." };
  }

  // maxHours
  if (body.maxHours !== undefined && Number(body.maxHours) < 1) {
    return { error: "'maxHours' deve ser ≥ 1." };
  }

  // maxHours > minHours
  if (body.minHours !== undefined && body.maxHours !== undefined) {
    if (Number(body.maxHours) <= Number(body.minHours)) {
      return { error: "'maxHours' deve ser superior a 'minHours'." };
    }
  }

  // maxDiscount
  if (body.maxDiscount !== undefined) {
    const d = Number(body.maxDiscount);
    if (d < 0 || d > 100) {
      return { error: "'maxDiscount' deve estar entre 0 e 100." };
    }
  }

  return null;
}
