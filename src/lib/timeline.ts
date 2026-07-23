import { prisma } from "./prisma";
import type { PrismaClient } from "@prisma/client";

type TX = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export type TimelineType =
  | "LEAD_CRIADO" | "LEAD_CONTACTADO" | "LEAD_CONVERTIDO"
  | "RESERVA_CRIADA" | "RESERVA_CONFIRMADA" | "RESERVA_CANCELADA"
  | "PAGAMENTO_RECEBIDO" | "PAGAMENTO_PENDENTE"
  | "FACTURA_EMITIDA" | "CONTRATO_CRIADO" | "NOTA" | "DOCUMENTO"
  // Extended types (not all routes use the strict set above)
  | string;

interface TimelineParams {
  type: string;
  title: string;
  description?: string;
  companyId?: string | null;
  leadId?: string | null;
  amount?: number;
  referenceId?: string;
  referenceType?: string;
  createdBy?: string | null;
}

/**
 * Two-argument form: addTimeline(tx, params) — used inside Prisma transactions.
 * One-argument form:  addTimeline(params)     — uses the global prisma client.
 */
export async function addTimeline(
  dbOrParams: (PrismaClient | TX) | TimelineParams,
  params?: TimelineParams,
) {
  let db: PrismaClient | TX;
  let p: TimelineParams;

  if (params !== undefined) {
    // Two-argument form
    db = dbOrParams as PrismaClient | TX;
    p  = params;
  } else {
    // One-argument form — use global prisma
    db = prisma as unknown as PrismaClient;
    p  = dbOrParams as TimelineParams;
  }

  await (db as PrismaClient).timeline.create({
    data: {
      companyId:     p.companyId     ?? null,
      leadId:        p.leadId        ?? null,
      type:          p.type,
      title:         p.title,
      description:   p.description   ?? null,
      amount:        p.amount        ?? null,
      referenceId:   p.referenceId   ?? null,
      referenceType: p.referenceType ?? null,
      createdBy:     p.createdBy     ?? null,
    },
  });
}
