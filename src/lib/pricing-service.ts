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
  plan:         PlanPricing;
  totalHours:   number;
  coffeeBreak:  boolean;
  discount:     number;
  ivaPercent:   number;
  isWeekend?:   boolean;
  startDate?:   Date;
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
  const { plan, totalHours, coffeeBreak, discount, ivaPercent, isWeekend, startDate } = input;

  const weekend = isWeekend ?? (startDate
    ? (startDate.getDay() === 0 || startDate.getDay() === 6)
    : false);

  let priceMode: PriceBreakdown["priceMode"] = "hourly";
  let baseAmount = plan.pricePerHour * totalHours;

  if (weekend && plan.weekendPrice > 0) {
    priceMode  = "weekend";
    baseAmount = plan.weekendPrice;
  } else if (totalHours >= 6 && plan.fullDayPrice > 0) {
    priceMode  = "fullDay";
    baseAmount = plan.fullDayPrice;
  } else if (totalHours >= 3 && plan.halfDayPrice > 0 && plan.halfDayPrice < plan.pricePerHour * totalHours) {
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
