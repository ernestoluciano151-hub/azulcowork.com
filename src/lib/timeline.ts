import { prisma } from "./prisma";
import type { PrismaClient, TimelineEventType } from "@prisma/client";

type TX = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// Mapeamento de tipos legados para TimelineEventType canónico (P5)
const TYPE_MAP: Record<string, TimelineEventType> = {
  RESERVA_CRIADA:       "BOOKING_CREATED",
  RESERVA_CONFIRMADA:   "BOOKING_CONFIRMED",
  RESERVA_CANCELADA:    "BOOKING_CANCELLED",
  LEAD_CRIADO:          "LEAD_CAPTURED",
  LEAD_CONTACTADO:      "CALL_MADE",
  LEAD_CONVERTIDO:      "DEAL_WON",
  PAGAMENTO_RECEBIDO:   "PAYMENT_RECEIVED",
  PAGAMENTO_PENDENTE:   "INVOICE_ISSUED",
  FACTURA_EMITIDA:      "INVOICE_ISSUED",
  CONTRATO_CRIADO:      "CONTRACT_CREATED",
  NOTA:                 "NOTE_ADDED",
};

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

  const writes: Promise<unknown>[] = [
    // legado — mantido para compatibilidade com vistas existentes
    (db as PrismaClient).timeline.create({
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
    }),
  ];

  // P5: dual-write para TimelineEntry (canónico) quando há companyId
  if (p.companyId) {
    const eventType: TimelineEventType = TYPE_MAP[p.type] ?? "NOTE_ADDED";
    writes.push(
      (db as PrismaClient).timelineEntry.create({
        data: {
          companyId:        p.companyId,
          eventType,
          title:            p.title,
          description:      p.description ?? null,
          actorName:        p.createdBy   ?? null,
          linkedEntityType: p.referenceType ?? null,
          linkedEntityId:   p.referenceId   ?? null,
          metadata: p.amount
            ? ({ amount: p.amount, legacyType: p.type } as object)
            : ({ legacyType: p.type } as object),
        },
      })
    );
  }

  await Promise.all(writes);
}
