# ERP Financeiro Integrado — Roadmap de Implementação

> **Volume:** 02 — ERP Financeiro Integrado  
> **Documento:** erp-roadmap.md  
> **Versão:** 1.0.0 — Julho 2026  
> **Product Owner:** Ernesto Pinto Luciano

---

## Decisão Estratégica: Consolidação Antes de Expansão

> **Portal do Cliente NÃO começa até consolidação completa do core.**

A sequência correcta de entrega de valor é:

```
1. CRM               ✅ Concluído — Sprint CRM-FE-7 (Jul 2026)
2. ERP Financeiro    🚧 Em execução (Jul–Set 2026)
3. Contratos         🚧 Em execução (Jul–Set 2026)
4. Cobrança          📋 Planeado (Set 2026)
5. Portal do Cliente 📋 Só após os pontos acima estarem estáveis
```

**Justificação:** O Portal do Cliente consome APIs de contratos, faturas e pagamentos.
Se essas APIs forem construídas com pressa e depois alteradas para suportar o portal,
cria-se dívida técnica desnecessária e riscos de regressão. APIs maduras e estáveis
primeiro; portal depois.

---

## Roadmap de Sprints

| Sprint | Objectivo | Estado | Duração |
|---|---|---|---|
| **ERP-0** | Especificação completa (26 documentos) | ✅ Concluído — Jul 2026 | 1 semana |
| **ERP-1** | Modelo de dados + Schema Prisma + Ledger | ✅ Concluído — Jul 2026 | 1 semana |
| **ERP-2** | Contratos e Rendas (activação + parcelas + faturação) | ✅ Concluído — Jul 2026 | 1 semana |
| **ERP-3** | Pagamentos (confirmação + recibo + ledger + reembolso) | ✅ Concluído — Jul 2026 | 1 semana |
| **ERP-4** | Contas a receber / pagar (despesas + AR aging + AP) | ✅ Concluído — Jul 2026 | 3 dias |
| **ERP-5** | Fluxo de caixa (real + projectado + KPIs + reconciliação) | ✅ Concluído — Jul 2026 | 3 dias |
| **ERP-6** | Alertas automáticos (7 tipos + cron diário + ciclo de vida) | ✅ Concluído — Jul 2026 | 3 dias |
| **ERP-7** | Dashboard financeiro (KPIs + MRR + snapshot) | ✅ Concluído — Jul 2026 | 1 semana |
| **ERP-8** | Comunicação financeira (PDFs + email + Cloudinary) | ✅ Concluído — Jul 2026 | 3 dias |
| **ERP-9** | Relatórios e BI (IVA + reconciliação + export) | ✅ Concluído — Jul 2026 | 1 semana |

**Total estimado:** ~8 semanas (Julho–Setembro 2026)

---

## Mapa de Objectivos por Sprint

### ERP-0 — Especificação completa ✅
- 26 documentos produzidos: domínio financeiro, modelo de dados, contratos, faturação,
  pagamentos, despesas, centros de custo, fluxo de caixa, relatórios, alertas, event catalog,
  API reference, migração, testes, diagramas, ADRs 021–025, executive summary
- Aprovação formal do Product Owner antes de qualquer linha de código

### ERP-1 — Modelo de dados + Ledger ✅
- 15 enums ERP + 12 modelos Prisma (ErpContract, ErpRentSchedule, ErpInvoice, ErpInvoiceItem,
  ErpPayment, FinancialLedger, ErpExpense, ExpenseCategory, CostCenter, CashMovement,
  FinancialAlert, FinancialReportSnapshot)
- Migration `erp-volume02` aplicada em produção (Neon)
- Seed: 9 CostCenters + 22 ExpenseCategories + DocumentCounters (NL, FT-SERV)

### ERP-2 — Contratos e rendas ✅
- `erp-contract-service.ts`: create, activate (gera RentSchedules), suspend, reactivate, terminate
- `erp-billing-service.ts`: calculateIvaTotals (IVA 14%), createErpInvoice, issueErpInvoice (+ledger), voidErpInvoice (+estorno)
- API Routes: `/api/erp/contracts/**` + `/api/erp/invoices/**`
- 23 testes unitários (IVA + BR-CONT-001)

### ERP-3 — Faturação completa (pagamentos) 🚧
- `erp-payment-service.ts`: register, confirm (+ledger +CashMovement +REC), reject, refund
- Partida dupla completa: DEBIT 1201 (banco), CREDIT 2111 (clientes)
- Geração atómica de número de recibo (REC-YYYY-NNNNNN)
- Resolução automática de alertas PAYMENT_OVERDUE na confirmação
- API Routes: `/api/erp/payments/**`

### ERP-4 — Contas a receber / pagar 📋
- Aging report AR: 30 / 60 / 90 / +90 dias em atraso
- Listagem de invoices OVERDUE por Company com dias em atraso
- API: `GET /api/erp/reports/aging`
- Relatório AP: despesas pendentes por vencer / em atraso

### ERP-5 — Fluxo de caixa 📋
- CashMovement: populado automaticamente por handlers de eventos (payment.confirmed, expense.paid)
- Projecções 30/60/90 dias: RentSchedules PENDING → INFLOW projectado; Expenses recorrentes → OUTFLOW projectado
- Saldo acumulado calculado sequencialmente
- Alerta automático se saldo projectado < limiar configurável
- API: `GET /api/erp/cashflow`

### ERP-6 — Alertas automáticos 📋
- Cron diário: CONTRACT_EXPIRING (60/30/7 dias), PAYMENT_OVERDUE, CONTRACT_EXPIRED
- Cron mensal: BUDGET_EXCEEDED por CostCenter
- Resend: emails para ADMIN/FINANCEIRO com resumo de alertas
- Ciclo de vida: ACTIVE → ACKNOWLEDGED → RESOLVED / SNOOZED
- API: `GET/PATCH /api/erp/alerts`

### ERP-7 — Dashboard financeiro ✅ Concluído — Jul 2026
- `erp-dashboard-service.ts`: getDashboardKpis, getPnl, getTrialBalance, getMrrBreakdown,
  getDelinquencyReport, getCostCenterReport, getContractsSummary, generateMonthlySnapshot
- KPIs em tempo real: MRR, ARR, churn, ticket médio, inadimplência %, projecção 90d
- P&L + Trial Balance a partir do FinancialLedger (partida dupla, ADR-021)
- FinancialReportSnapshot: upsert atómico por `period + type` — cron `0 22 28-31 * *`
- API Routes: `GET /api/erp/dashboard`, `/reports/pnl`, `/reports/mrr`,
  `/reports/contracts`, `/reports/delinquency`, `/reports/cost-centers`
- Cron: `GET /api/cron/erp-monthly-snapshot` (CRON_SECRET)
- Testes unitários: `erp-dashboard-service.test.ts` (MRR/ARR, churn, ticket médio,
  gross margin, EBIT, partida dupla, MRR breakdown, CostCenter status)

### ERP-8 — Comunicação financeira ✅ Concluído — Jul 2026
- `erp-pdf-service.tsx`: `generateInvoicePdf` + `generateReceiptPdf` via `@react-pdf/renderer` v4
  - Factura: cabeçalho Azul Coworking, NIF, dados cliente, tabela itens, IVA 14%, dados BCS
  - Recibo: n.º REC, factura ref., método, valor em destaque, mensagem de agradecimento
- `erp-email-service.ts`: `sendInvoiceEmail`, `sendReceiptEmail`, `sendReminderEmail`, `sendOverdueEmail`
  - 4 templates HTML responsivos via nodemailer (SMTP)
  - Graceful degradation quando SMTP não configurado
- `erp-communication-service.ts`: orquestrador PDF → Cloudinary → BD → Email → Evento
  - `sendInvoice(id)` → ISSUED → SENT + `pdfUrl` + `sentAt` + `sentTo`
  - `sendReceipt(id)` → `receiptUrl` actualizado
  - `sendPaymentReminder(id)` + `sendOverdueNotice(id)` — lembretes manuais
- Cloudinary: `/azul-cowork/erp/invoices/YYYY/MM/` e `/receipts/YYYY/MM/` (resource_type: raw)
- API Routes: `POST /api/erp/invoices/[id]/send`, `/receipt` (payment), `/remind`
- Testes unitários: `erp-communication-service.test.ts` (33 testes)

### ERP-9 — Relatórios e BI ✅ Concluído — Jul 2026
- `erp-vat-report-service.ts`: `getVatReport(period?)` + `getVatHistory(months)`
  - IVA Angola 14% (Lei n.º 17/19); contas 2311 (output/CREDIT) e 2312 (input/DEBIT)
  - Apuramento: vatBalance = outputVat − inputVat; status DUE / CREDIT / ZERO
  - Base calculada inversamente: `Math.round(entry.amount / IVA_RATE)`
- `erp-reconciliation-service.ts`: `getReconciliationReport(period?, bankAccount?)`
  - Threshold Kz 1.000: discrepância acima → MISMATCH
  - Compara CashMovements reais vs ErpPayments CONFIRMED e ErpExpenses PAID
  - openingBalance / closingBalance calculados a partir de CashMovement histórico
- `erp-export-service.ts`: 6 tipos exportáveis em XLSX ou CSV via exceljs
  - `exportPnl`, `exportAgingAr`, `exportMrrBreakdown`, `exportVatReport`,
    `exportCostCenters`, `exportDelinquency`
  - Resposta binária com Content-Disposition para download directo
- API Routes: `GET /api/erp/reports/vat`, `/reconciliation`, `/export`
- Testes unitários: `erp-reports-service.test.ts` — 42 testes
  (IVA apuramento, cálculo inverso, vatStatus, MISMATCH detection, export filenames)

---

## Pós-ERP — Sequência de Volumes

```
Volume 02 — ERP (Jul–Set 2026)        ← em execução
Volume 03 — Cowork (Out 2026)         ← gestão de espaços, check-in, benefícios
Volume 04 — Reservas (Nov 2026)       ← salas de reunião v2 (integração ERP completa)
Volume 05 — Portal do Cliente (2027)  ← consome APIs maduras e estáveis
```

---

## Critérios de Saída do ERP (Definition of Done do Volume)

Para considerar o Volume 02 — ERP concluído, todos os seguintes critérios devem ser verdadeiros:

```
□ ERP-9 concluído e todos os testes passam
□ Quality Gate: cobertura ≥ 60% nos módulos críticos (billing, payments, ledger)
□ Migration de dados históricos executada e validada
□ Dashboard financeiro operacional com dados reais
□ Primeiro contrato ERP criado manualmente e ativo em produção
□ Primeira fatura ERP emitida, paga e com recibo gerado
□ Relatório mensal P&L gerado para Julho 2026
□ Documentação actualizada (todos os docs com estado ✅ Implementado)
□ ADRs 021–025 marcados como ACEITE
□ Ernesto (PO) valida o sistema em ambiente de produção
```

---

*VD Platform — ERP Roadmap v1.0.0 — Julho 2026*  
*Decisão estratégica: Portal do Cliente só após consolidação de CRM + ERP + Cobrança*
