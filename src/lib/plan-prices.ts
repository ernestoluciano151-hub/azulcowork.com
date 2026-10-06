/**
 * plan-prices.ts — preços por plano de coworking (SSoT: tabela CoworkingPlanPrice).
 * Valores iniciais = preçário público actual; o admin edita em
 * Configurações → Sala de Reunião.
 */
import { prisma } from "@/lib/prisma";

export const DEFAULT_PLAN_PRICES: { planType: string; monthlyPrice: number; dailyPrice: number | null; sortOrder: number }[] = [
  { planType: "Hot Desk",            monthlyPrice: 69000,  dailyPrice: 9900, sortOrder: 0 },
  { planType: "Sala Privada",        monthlyPrice: 119900, dailyPrice: null, sortOrder: 1 },
  { planType: "Sala Privada Grande", monthlyPrice: 285500, dailyPrice: null, sortOrder: 2 },
  { planType: "Virtual Office",      monthlyPrice: 19900,  dailyPrice: null, sortOrder: 3 },
];

/** Planos sem preço próprio: usam o de outro plano (Sala Dedicada = Sala Privada). */
export const PLAN_PRICE_ALIASES: Record<string, string> = {
  "Sala Dedicada": "Sala Privada",
};

/** Devolve todos os preços, criando os que ainda não existem (idempotente). */
export async function getPlanPrices() {
  await prisma.coworkingPlanPrice.createMany({ data: DEFAULT_PLAN_PRICES, skipDuplicates: true });
  const names = DEFAULT_PLAN_PRICES.map(p => p.planType);
  return prisma.coworkingPlanPrice.findMany({ where: { planType: { in: names } }, orderBy: { sortOrder: "asc" } });
}

/** Preço mensal configurado para um tipo de plano, ou null se não existir (ex.: "Outro"). */
export async function getPlanMonthlyPrice(planType: string | null | undefined): Promise<number | null> {
  if (!planType) return null;
  const key = PLAN_PRICE_ALIASES[planType] ?? planType;
  try {
    const row = await prisma.coworkingPlanPrice.findUnique({ where: { planType: key } });
    return row ? row.monthlyPrice : null;
  } catch {
    // tabela ainda não migrada: nunca bloquear o fluxo chamador por causa disto
    return null;
  }
}
