/**
 * plan-prices.ts — preços por plano de coworking (SSoT: tabela CoworkingPlanPrice).
 * Valores iniciais = preçário público actual; o admin edita em
 * Configurações → Sala de Reunião.
 */
import { prisma } from "@/lib/prisma";

export const DEFAULT_PLAN_PRICES: { planType: string; monthlyPrice: number; dailyPrice: number | null; sortOrder: number }[] = [
  { planType: "Hot Desk",       monthlyPrice: 79900,  dailyPrice: 9900, sortOrder: 0 },
  { planType: "Sala Privada",   monthlyPrice: 119900, dailyPrice: null, sortOrder: 1 },
  { planType: "Sala Dedicada",  monthlyPrice: 299900, dailyPrice: null, sortOrder: 2 },
  { planType: "Virtual Office", monthlyPrice: 19900,  dailyPrice: null, sortOrder: 3 },
];

/** Devolve todos os preços, criando os que ainda não existem (idempotente). */
export async function getPlanPrices() {
  await prisma.coworkingPlanPrice.createMany({ data: DEFAULT_PLAN_PRICES, skipDuplicates: true });
  return prisma.coworkingPlanPrice.findMany({ orderBy: { sortOrder: "asc" } });
}

/** Preço mensal configurado para um tipo de plano, ou null se não existir (ex.: "Outro"). */
export async function getPlanMonthlyPrice(planType: string | null | undefined): Promise<number | null> {
  if (!planType) return null;
  try {
    const row = await prisma.coworkingPlanPrice.findUnique({ where: { planType } });
    return row ? row.monthlyPrice : null;
  } catch {
    // tabela ainda não migrada: nunca bloquear o fluxo chamador por causa disto
    return null;
  }
}
