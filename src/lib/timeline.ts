import type { PrismaClient } from "@prisma/client";

type TX = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export type TimelineType =
  | "LEAD_CRIADO" | "LEAD_CONTACTADO" | "LEAD_CONVERTIDO"
  | "RESERVA_CRIADA" | "RESERVA_CONFIRMADA" | "RESERVA_CANCELADA"
  | "PAGAMENTO_RECEBIDO" | "PAGAMENTO_PENDENTE"
  | "FACTURA_EMITIDA" | "CONTRATO_CRIADO" | "NOTA" | "DOCUMENTO";

export async function addTimeline(
  db: PrismaClient | TX,
  params: {
    type: TimelineType;
    title: string;
    description?: string;
    companyId?: string | null;
    leadId?: string | null;
    amount?: number;
    referenceId?: string;
    referenceType?: string;
    createdBy?: string;
  }
) {
  await (db as PrismaClient).timeline.create({
    data: {
      companyId:     params.companyId     ?? null,
      leadId:        params.leadId        ?? null,
      type:          params.type,
      title:         params.title,
      description:   params.description   ?? null,
      amount:        params.amount        ?? null,
      referenceId:   params.referenceId   ?? null,
      referenceType: params.referenceType ?? null,
      createdBy:     params.createdBy     ?? null,
    },
  });
}
