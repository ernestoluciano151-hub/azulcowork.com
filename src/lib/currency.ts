export function formatKz(amount: number): string {
  return amount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Kz";
}
