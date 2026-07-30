/**
 * document-numbering.ts — Numeração atómica de documentos financeiros (DT-014)
 *
 * Substitui o padrão `count + 1` que sofria de race condition em requests
 * concorrentes. Usa `upsert` + `increment` do PostgreSQL dentro de uma
 * transacção, garantindo que cada número é único mesmo sob concorrência.
 *
 * Uso obrigatório DENTRO de prisma.$transaction:
 *   const invoiceNumber = await nextDocumentNumber(tx, "FT-SALA");
 *   // → "FT-SALA-2026-000001"
 *
 * Formatos de saída:
 *   FT-SALA  → FT-SALA-YYYY-NNNNNN   (Faturas de sala de reunião)
 *   FT-CWORK → FT-CWORK-YYYY-NNNNNN  (Faturas de coworking)
 *   REC      → REC-YYYY-NNNNNN       (Recibos de pagamento)
 *   NL       → NL-YYYY-NNNNNN        (Notas de Liquidação)
 *   RES      → RES-YYYY-NNNNNN       (Números de Reserva)
 */

import type { DbClient } from "@/lib/finance";

export type DocumentType = "FT-SALA" | "FT-CWORK" | "FT-SERV" | "REC" | "NL" | "RES" | "ST";

/**
 * Gera o próximo número de documento de forma atómica.
 * DEVE ser chamado dentro de prisma.$transaction().
 *
 * @param tx  - Cliente de transacção Prisma (tx do $transaction callback)
 * @param type - Tipo de documento (FT-SALA, FT-CWORK, REC, NL, RES)
 * @param year - Ano (default: ano actual)
 * @returns Número formatado, ex: "FT-SALA-2026-000001"
 */
export async function nextDocumentNumber(
  tx: DbClient,
  type: DocumentType,
  year: number = new Date().getFullYear()
): Promise<string> {
  const counter = await tx.documentCounter.upsert({
    where:  { type_year: { type, year } },
    update: { lastSeq: { increment: 1 } },
    create: { type, year, lastSeq: 1 },
  });

  return `${type}-${year}-${String(counter.lastSeq).padStart(6, "0")}`;
}
