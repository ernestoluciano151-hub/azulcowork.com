/**
 * PricingService — Pure calculation, no DB access.
 * All price computations live here; UI and API call this.
 */

export interface PlanPricing {
  pricePerHour:    number;
  halfDayPrice:    number;  // 4h flat
  fullDayPrice:    number;  // 8h flat
  weekendPrice:    number;
  coffeeBreakPrice: number;
}

export interface PriceInput {
  plan:         PlanPricing;
  totalHours:   number;
  coffeeBreak:  boolean;
  discount:     number;    // absolute value in AOA
  ivaPercent:   number;    // e.g. 14 for 14%
  isWeekend?:   boolean;
  startDate?:   Date;
}

export interface PriceBreakdown {
  priceMode:     "hourly" | "halfDay" | "fullDay" | "weekend";
  baseAmount:    number;   // before coffee break
  coffeeExtra:   number;
  subtotal:      number;   // base + coffee
  discountApplied: number; // min(discount, subtotal)
  afterDiscount: number;
  ivaAmount:     number;
  totalAmount:   number;
}

/**
 * Calculate the best applicable price for the given duration.
 * Rules:
 *  - If weekend && weekendPrice > 0 → use weekendPrice (flat, any duration)
 *  - If hours >= 6 && fullDayPrice > 0 → use fullDayPrice (flat)
 *  - If hours >= 3 && halfDayPrice > 0 && halfDayPrice < pricePerHour*hours → use halfDayPrice
 *  - Otherwise → pricePerHour × hours
 */
export function calcPrice(input: PriceInput): PriceBreakdown {
  const { plan, totalHours, coffeeBreak, discount, ivaPercent, isWeekend, startDate } = input;

  // Detect weekend from startDate if not explicit
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

  baseAmount = Math.round(baseAmount * 100) / 100;

  const coffeeExtra   = coffeeBreak ? plan.coffeeBreakPrice : 0;
  const subtotal      = baseAmount + coffeeExtra;
  const discountApplied = Math.min(Math.max(0, discount), subtotal);
  const afterDiscount = subtotal - discountApplied;
  const ivaAmount     = Math.round((afterDiscount * ivaPercent / 100) * 100) / 100;
  const totalAmount   = Math.round((afterDiscount + ivaAmount) * 100) / 100;

  return { priceMode, baseAmount, coffeeExtra, subtotal, discountApplied, afterDiscount, ivaAmount, totalAmount };
}

export function priceModeLabel(mode: PriceBreakdown["priceMode"]): string {
  return { hourly: "Por hora", halfDay: "Meio dia", fullDay: "Dia inteiro", weekend: "Fim de semana" }[mode];
}
