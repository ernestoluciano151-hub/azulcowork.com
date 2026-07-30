/**
 * GET /api/cron/erp-daily
 * Cron job diário do ERP — executado às 07:00 Africa/Luanda via Vercel Cron.
 *
 * Sequência de execução:
 *  1. processExpiredSnoozes  — reactiva alertas SNOOZED expirados
 *  2. checkContractExpired   — contratos ACTIVE com endDate passada → EXPIRED
 *  3. checkContractExpiring  — alertas de contratos a expirar (60/30/7 dias)
 *  4. checkPaymentOverdue    — faturas em atraso → OVERDUE + alertas
 *  5. checkDepositDue        — cauções não pagas há > 15 dias
 *  6. checkBudgetExceeded    — despesas do mês vs orçamento de cada CC
 *  7. detectNegativeBalance  — projecção de caixa 30 dias
 *
 * Segurança: requer header Authorization: Bearer ${CRON_SECRET}
 *
 * Configuração Vercel (vercel.json):
 *  { "crons": [{ "path": "/api/cron/erp-daily", "schedule": "0 6 * * *" }] }
 *  (UTC 06:00 = Africa/Luanda 07:00)
 *
 * Docs: docs/05-erp/alerts.md
 */

import { NextRequest, NextResponse }     from "next/server";
import { processExpiredSnoozes,
         checkContractExpired,
         checkContractExpiring,
         checkPaymentOverdue,
         checkDepositDue,
         checkBudgetExceeded }            from "@/lib/erp-alerts-service";
import { detectNegativeBalance }          from "@/lib/erp-cashflow-service";
import "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const startedAt = Date.now();
  const results: Record<string, unknown> = {};
  const errors:  Record<string, string>  = {};

  // 1. Reactivar snoozes expirados
  try {
    results.expiredSnoozes = await processExpiredSnoozes();
  } catch (e) {
    errors.expiredSnoozes = e instanceof Error ? e.message : "Erro desconhecido";
  }

  // 2. Contratos expirados
  try {
    results.contractExpired = await checkContractExpired();
  } catch (e) {
    errors.contractExpired = e instanceof Error ? e.message : "Erro desconhecido";
  }

  // 3. Contratos a expirar
  try {
    results.contractExpiring = await checkContractExpiring();
  } catch (e) {
    errors.contractExpiring = e instanceof Error ? e.message : "Erro desconhecido";
  }

  // 4. Faturas em atraso
  try {
    results.paymentOverdue = await checkPaymentOverdue();
  } catch (e) {
    errors.paymentOverdue = e instanceof Error ? e.message : "Erro desconhecido";
  }

  // 5. Cauções em atraso
  try {
    results.depositDue = await checkDepositDue();
  } catch (e) {
    errors.depositDue = e instanceof Error ? e.message : "Erro desconhecido";
  }

  // 6. Orçamentos excedidos (todos os centros de custo)
  try {
    results.budgetExceeded = await checkBudgetExceeded();
  } catch (e) {
    errors.budgetExceeded = e instanceof Error ? e.message : "Erro desconhecido";
  }

  // 7. Saldo projectado negativo
  try {
    const alert = await detectNegativeBalance();
    results.negativeBalance = alert
      ? { alertId: alert.id, severity: alert.severity }
      : { status: "ok" };
  } catch (e) {
    errors.negativeBalance = e instanceof Error ? e.message : "Erro desconhecido";
  }

  const durationMs  = Date.now() - startedAt;
  const hasErrors   = Object.keys(errors).length > 0;

  console.log("[CRON erp-daily]", { results, errors, durationMs });

  return NextResponse.json({
    ok:        !hasErrors,
    durationMs,
    results,
    ...(hasErrors && { errors }),
  }, { status: hasErrors ? 207 : 200 }); // 207 Multi-Status se houver erros parciais
}
