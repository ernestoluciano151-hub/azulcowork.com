/**
 * erp-invoice-generate-service.ts
 *
 * Serviço de geração automática de faturas mensais para rendas de coworking.
 *
 * Responsabilidade:
 *  Processar entradas ErpRentSchedule com status=PENDING e dueDate <= agora,
 *  gerando automaticamente uma ErpInvoice (DRAFT → ISSUED) para cada uma.
 *
 * Garantias:
 *  - Idempotente: o campo invoiceId (@@unique) impede duplicação
 *  - Transaccional: createInvoice + update status na mesma $transaction
 *  - Fire-and-forget: issueErpInvoice + email nunca bloqueiam nem falham o ciclo
 *
 * Invocado por: /api/cron/erp-invoice-generate (cron mensal — 1.º dia do mês, 08:00 Luanda)
 *
 * Docs: docs/13-automacoes/README.md
 */

import { prisma }                        from "@/lib/prisma";
import { ErpInvoiceType, RentScheduleStatus } from "@prisma/client";
import { createErpInvoice, issueErpInvoice }  from "@/lib/erp-billing-service";
import { sendEmail }                          from "@/lib/communication-service";

const ACTOR_ID = "SYSTEM_CRON";

// ── Tipo de retorno ────────────────────────────────────────────────────────────

export interface InvoiceGenerateResult {
  scheduleId:  string;
  companyId:   string;
  companyName: string;
  invoiceId:   string;
  amount:      number;
  status:      "generated" | "skipped" | "error";
  error?:      string;
}

// ── Função principal ───────────────────────────────────────────────────────────

/**
 * Processa todas as rendas vencidas (PENDING e dueDate ≤ agora).
 *
 * Para cada ErpRentSchedule:
 *  1. Cria fatura DRAFT dentro de $transaction
 *  2. Actualiza schedule.status = INVOICED e schedule.invoiceId na mesma tx
 *  3. (fire-and-forget) Emite a fatura (DRAFT → ISSUED) + envia email ao cliente
 *
 * Retorna um resumo de cada item processado.
 */
export async function generateMonthlyInvoices(): Promise<InvoiceGenerateResult[]> {
  const now = new Date();

  // Buscar schedules vencidos: PENDING + dueDate no passado ou hoje
  const pendingSchedules = await prisma.erpRentSchedule.findMany({
    where: {
      status:  RentScheduleStatus.PENDING,
      dueDate: { lte: now },
    },
    include: {
      company:  { select: { id: true, name: true, billingEmail: true, email: true } },
      contract: { select: { id: true, planName: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  if (pendingSchedules.length === 0) {
    return [];
  }

  const results: InvoiceGenerateResult[] = [];

  for (const schedule of pendingSchedules) {
    try {
      // Verificar idempotência: se já tiver invoiceId, ignorar (nunca deve acontecer
      // dado @@unique, mas defensivamente verificamos)
      if (schedule.invoiceId) {
        results.push({
          scheduleId:  schedule.id,
          companyId:   schedule.companyId,
          companyName: schedule.company.name,
          invoiceId:   schedule.invoiceId,
          amount:      schedule.amount,
          status:      "skipped",
          error:       "Já tem invoiceId associado.",
        });
        continue;
      }

      // Criar fatura DRAFT + actualizar schedule numa única $transaction
      const invoice = await prisma.$transaction(async (tx) => {
        // createErpInvoice usa prisma internamente — para transaccionar correctamente
        // criamos o invoice via o serviço mas num contexto detached, depois linked.
        // Padrão adoptado: chamar createErpInvoice fora e usar tx apenas para update.
        // (createErpInvoice já usa prisma.$transaction internamente para a numeração
        //  em issueErpInvoice; aqui usamos $transaction para o link schedule→invoice)

        // 1. Criar fatura DRAFT (usa prisma directo — não tx — para poder usar
        //    $transaction interno de createErpInvoice)
        // NOTA: Este bloco é wrappado em tx para garantir que se o update do schedule
        //       falhar, a fatura criada não fica "solta" e sem link.
        //
        // Usamos tx.erpInvoice.create directamente para evitar transacções aninhadas.
        const { calculateIvaTotals } = await import("@/lib/erp-billing-service");
        const { ErpInvoiceStatus }   = await import("@prisma/client");

        const itemsSubtotal = Math.round(schedule.amount);
        const { subtotal, taxAmount, taxRate, total } = calculateIvaTotals(itemsSubtotal);

        const dueDate = new Date(schedule.dueDate);

        const inv = await tx.erpInvoice.create({
          data: {
            number:     `DRAFT-CRON-${Date.now()}`,   // substituído em issueErpInvoice
            type:       ErpInvoiceType.COWORKING,
            companyId:  schedule.companyId,
            contractId: schedule.contractId,
            status:     ErpInvoiceStatus.DRAFT,
            issueDate:  now,
            dueDate,
            subtotal,
            taxRate,
            taxAmount,
            total,
            notes:      `Renda automática — ${schedule.contract?.planName ?? "Coworking"} — ${formatMonthPt(schedule.dueDate)}`,
            createdBy:  ACTOR_ID,
            items: {
              create: [{
                description: `Renda mensal — ${schedule.contract?.planName ?? "Coworking"} — ${formatMonthPt(schedule.dueDate)}`,
                quantity:    1,
                unitPrice:   itemsSubtotal,
                total:       itemsSubtotal,
                accountCode: "7111",   // Rendas coworking — PGC Angola
              }],
            },
          },
        });

        // 2. Actualizar schedule: PENDING → INVOICED + link ao invoice
        await tx.erpRentSchedule.update({
          where: { id: schedule.id },
          data:  {
            status:    RentScheduleStatus.INVOICED,
            invoiceId: inv.id,
          },
        });

        return inv;
      });

      results.push({
        scheduleId:  schedule.id,
        companyId:   schedule.companyId,
        companyName: schedule.company.name,
        invoiceId:   invoice.id,
        amount:      schedule.amount,
        status:      "generated",
      });

      // ── Fire-and-forget: emitir fatura (DRAFT → ISSUED) + email ─────────────
      void (async () => {
        try {
          await issueErpInvoice(invoice.id, ACTOR_ID);

          // Buscar fatura emitida para obter número definitivo
          const issued = await prisma.erpInvoice.findUnique({
            where:  { id: invoice.id },
            select: { number: true, total: true, dueDate: true },
          });

          const billingEmail = schedule.company.billingEmail ?? schedule.company.email;
          if (billingEmail && issued) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
            const portalUrl = `${appUrl}/portal/faturas`;

            void sendEmail({
              templateSlug: "erp-invoice-issued",
              to:           billingEmail,
              subject:      `Fatura ${issued.number} — ${schedule.company.name} — Azul Coworking`,
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                  <h2 style="color:#1e40af">Azul Coworking — Fatura de Renda</h2>
                  <p>Estimado cliente <strong>${schedule.company.name}</strong>,</p>
                  <p>A sua fatura mensal foi emitida:</p>
                  <table style="width:100%;border-collapse:collapse;margin:16px 0">
                    <tr>
                      <td style="padding:8px;border:1px solid #e5e7eb">Número</td>
                      <td style="padding:8px;border:1px solid #e5e7eb"><strong>${issued.number}</strong></td>
                    </tr>
                    <tr>
                      <td style="padding:8px;border:1px solid #e5e7eb">Valor Total</td>
                      <td style="padding:8px;border:1px solid #e5e7eb"><strong>Kz ${issued.total.toLocaleString("pt-AO")}</strong></td>
                    </tr>
                    <tr>
                      <td style="padding:8px;border:1px solid #e5e7eb">Data de Vencimento</td>
                      <td style="padding:8px;border:1px solid #e5e7eb">${formatDatePt(issued.dueDate)}</td>
                    </tr>
                  </table>
                  <p style="text-align:center;margin:32px 0">
                    <a href="${portalUrl}"
                       style="background:#1e40af;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
                      Ver Fatura no Portal
                    </a>
                  </p>
                  <p style="font-size:12px;color:#6b7280">
                    Azul Coworking · Bairro Azul, Edifício 18, Luanda, Angola<br>
                    IBAN: AO06007000000212870210113 · BCS · SWIFT: CDTSAOLU
                  </p>
                </div>`,
              vars: {
                invoiceNumber: issued.number,
                companyName:   schedule.company.name,
                totalAmount:   `Kz ${issued.total.toLocaleString("pt-AO")}`,
                dueDate:       formatDatePt(issued.dueDate),
                portalUrl,
              },
              channel:     "receipt",
              entityType:  "INVOICE",
              entityId:    invoice.id,
              triggeredBy: "SYSTEM",
            }).catch((err: unknown) =>
              console.error(`[InvoiceGenerate] Erro ao enviar email fatura ${invoice.id}:`, err)
            );
          }
        } catch (issueErr) {
          console.error(
            `[InvoiceGenerate] Erro ao emitir fatura ${invoice.id} (schedule ${schedule.id}):`,
            issueErr
          );
        }
      })();

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error(`[InvoiceGenerate] Falha no schedule ${schedule.id}:`, err);
      results.push({
        scheduleId:  schedule.id,
        companyId:   schedule.companyId,
        companyName: schedule.company.name,
        invoiceId:   "",
        amount:      schedule.amount,
        status:      "error",
        error:       message,
      });
    }
  }

  return results;
}

// ── Helpers de formatação ─────────────────────────────────────────────────────

function formatMonthPt(date: Date): string {
  return date.toLocaleDateString("pt-AO", {
    month: "long",
    year:  "numeric",
    timeZone: "Africa/Luanda",
  });
}

function formatDatePt(date: Date): string {
  return date.toLocaleDateString("pt-AO", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
    timeZone: "Africa/Luanda",
  });
}
