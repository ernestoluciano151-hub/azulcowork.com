/**
 * owner.ts — Proprietário da plataforma (14 Out 2026, pedido do PO)
 *
 * Apenas o proprietário (Ernesto) pode: gerir utilizadores (criar, atribuir papéis,
 * desactivar, eliminar, repor senhas) e aprovar/rejeitar pedidos de eliminação e
 * aprovações (despesas ERP, pagamentos ERP). Módulo puro — seguro para o Edge (middleware).
 * Pode ser alterado com a variável de ambiente OWNER_EMAIL.
 */
export const OWNER_EMAIL = (process.env.OWNER_EMAIL || "ernesto@azulcowork.com").trim().toLowerCase();

export function isOwnerEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}
