/**
 * bi-helpers.ts — VOL06
 *
 * Funções utilitárias puras para os endpoints de Business Intelligence.
 * Sem dependências externas — totalmente testáveis sem mocks.
 */

/** Converte uma Date em chave "YYYY-MM". */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Gera um array das últimas N chaves de mês em ordem crescente.
 * Ex.: lastNMonths(3) em Julho 2026 → ["2026-05", "2026-06", "2026-07"]
 */
export function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  return months;
}

/**
 * Calcula o número aproximado de dias úteis num dado mês (ratio 5/7).
 * @param mk  Chave no formato "YYYY-MM"
 */
export function workingDaysInMonth(mk: string): number {
  const [yearStr, monthStr] = mk.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.round(daysInMonth * (5 / 7));
}

/**
 * Inicializa um mapa Record<string, number> com 0 para cada chave do array.
 */
export function zeroMap(keys: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const k of keys) map[k] = 0;
  return map;
}

/**
 * Calcula a taxa de ocupação mensal da sala a partir de um mapa de horas reservadas.
 * @param monthsList     Lista de chaves de mês
 * @param bookedMap      Mapa mês → horas reservadas
 * @param dailyHours     Horas disponíveis por dia (default 10)
 */
export function buildOccupancyResult(
  monthsList: string[],
  bookedMap: Record<string, number>,
  dailyHours: number
): { month: string; bookedHours: number; availableHours: number; rate: number }[] {
  return monthsList.map((m) => {
    const bookedHours = Math.round((bookedMap[m] ?? 0) * 10) / 10;
    const availableHours = workingDaysInMonth(m) * dailyHours;
    const rate =
      availableHours > 0
        ? Math.round((bookedHours / availableHours) * 1000) / 10
        : 0;
    return { month: m, bookedHours, availableHours, rate };
  });
}
