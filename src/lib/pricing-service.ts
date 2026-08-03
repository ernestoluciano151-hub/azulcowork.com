/**
 * PricingService — Pure calculation, no DB access.
 * All price computations live here; UI and API call this.
 */

export interface PlanPricing {
  pricePerHour:    number;
  halfDayPrice:    number;
  fullDayPrice:    number;
  weekendPrice:    number;
  coffeeBreakPrice: number;
}

export interface RoomPricingTier {
  id:              string;
  label:           string;
  durationMinutes: number;
  price:           number;
}

export interface PriceInput {
  plan:          PlanPricing;
  totalHours:    number;
  /** Duração exacta em minutos. Se omitido, é derivada de totalHours (menos precisa). */
  totalMinutes?: number;
  coffeeBreak:   boolean;
  discount:      number;
  ivaPercent:    number;
  isWeekend?:    boolean;
  startDate?:    Date;
}

/** Tarifa horária por defeito da Sala de Reunião (Kz), usada quando o plano
 * não tem pricePerHour definido. */
export const ROOM_HOURLY_RATE_KZ = 15000;

/**
 * roundBillableHours — Converte a duração real (minutos) em horas facturáveis.
 *
 * Regra de negócio: a reserva é cobrada por hora completa. Se o tempo que
 * ultrapassa a última hora completa for de até 30 minutos, o preço mantém-se
 * nessa hora; se ultrapassar os 30 minutos, arredonda-se para a hora seguinte.
 *
 * Exemplos (para 1h base):
 *   60 min  (1h00) → 1h  (não excede)
 *   80 min  (1h20) → 1h  (excedente de 20 min ≤ 30)
 *   90 min  (1h30) → 1h  (excedente de exactamente 30 min — ainda não passou)
 *   91 min  (1h31) → 2h  (excedente de 31 min > 30 — mais próximo de 2h)
 *  120 min  (2h00) → 2h
 */
export function roundBillableHours(totalMinutes: number): number {
  if (totalMinutes <= 0) return 0;
  const wholeHours = Math.floor(totalMinutes / 60);
  const remainder  = totalMinutes - wholeHours * 60;
  if (remainder > 30) return wholeHours + 1;
  return wholeHours > 0 ? wholeHours : 1;
}

export interface PriceBreakdown {
  priceMode:       "tier" | "hourly" | "halfDay" | "fullDay" | "weekend";
  tierLabel?:      string;
  baseAmount:      number;
  coffeeExtra:     number;
  subtotal:        number;
  discountApplied: number;
  afterDiscount:   number;
  ivaAmount:       number;
  totalAmount:     number;
}

/**
 * matchTier — Find the best pricing tier for a given duration in minutes.
 * Priority: exact match → closest tier with durationMinutes ≤ actual duration.
 */
export function matchTier(
  tiers: RoomPricingTier[],
  durationMinutes: number
): RoomPricingTier | undefined {
  const sorted = [...tiers].sort((a, b) => a.durationMinutes - b.durationMinutes);
  const exact  = sorted.find(t => t.durationMinutes === durationMinutes);
  if (exact) return exact;
  return sorted.filter(t => t.durationMinutes <= durationMinutes).at(-1);
}

/**
 * calcPriceFromTier — Use a matched DB pricing tier as the base price.
 */
export function calcPriceFromTier(
  tier: RoomPricingTier,
  coffeeBreakPrice: number,
  coffeeBreak: boolean,
  discount: number,
  ivaPercent: number
): PriceBreakdown {
  return _applyOverheads("tier", tier.price, coffeeBreakPrice, coffeeBreak, discount, ivaPercent, tier.label);
}

/**
 * calcPrice — Fallback when no DB tier exists.
 * Uses plan-level prices (halfDay / fullDay / weekend / hourly).
 */
export function calcPrice(input: PriceInput): PriceBreakdown {
  const { plan, totalHours, totalMinutes, coffeeBreak, discount, ivaPercent, isWeekend, startDate } = input;

  const weekend = isWeekend ?? (startDate
    ? (startDate.getDay() === 0 || startDate.getDay() === 6)
    : false);

  // Tarifa horária efectiva: usa a do plano se configurada, senão a tarifa
  // base da Sala de Reunião (15.000 Kz/h).
  const hourlyRate = plan.pricePerHour > 0 ? plan.pricePerHour : ROOM_HOURLY_RATE_KZ;
  const minutes    = totalMinutes ?? Math.round(totalHours * 60);

  let priceMode: PriceBreakdown["priceMode"] = "hourly";
  // Facturação por hora com arredondamento de 30 min (ver roundBillableHours).
  let baseAmount = hourlyRate * roundBillableHours(minutes);

  if (weekend && plan.weekendPrice > 0) {
    priceMode  = "weekend";
    baseAmount = plan.weekendPrice;
  } else if (totalHours >= 6 && plan.fullDayPrice > 0) {
    priceMode  = "fullDay";
    baseAmount = plan.fullDayPrice;
  } else if (totalHours >= 3 && plan.halfDayPrice > 0 && plan.halfDayPrice < hourlyRate * totalHours) {
    priceMode  = "halfDay";
    baseAmount = plan.halfDayPrice;
  }

  return _applyOverheads(priceMode, baseAmount, plan.coffeeBreakPrice, coffeeBreak, discount, ivaPercent);
}

function _applyOverheads(
  priceMode: PriceBreakdown["priceMode"],
  baseAmount: number,
  coffeeBreakPrice: number,
  coffeeBreak: boolean,
  discount: number,
  ivaPercent: number,
  tierLabel?: string
): PriceBreakdown {
  baseAmount = Math.round(baseAmount * 100) / 100;
  const coffeeExtra     = coffeeBreak ? coffeeBreakPrice : 0;
  const subtotal        = baseAmount + coffeeExtra;
  const discountApplied = Math.min(Math.max(0, discount), subtotal);
  const afterDiscount   = subtotal - discountApplied;
  const ivaAmount       = Math.round((afterDiscount * ivaPercent / 100) * 100) / 100;
  const totalAmount     = Math.round((afterDiscount + ivaAmount) * 100) / 100;
  return { priceMode, tierLabel, baseAmount, coffeeExtra, subtotal, discountApplied, afterDiscount, ivaAmount, totalAmount };
}

export function priceModeLabel(mode: PriceBreakdown["priceMode"], tierLabel?: string): string {
  if (mode === "tier" && tierLabel) return tierLabel;
  return { hourly: "Por hora", halfDay: "Meio dia", fullDay: "Dia inteiro", weekend: "Fim de semana", tier: "Tabela" }[mode];
}
