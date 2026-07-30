# Volume 02 — ERP Financeiro Integrado

> **Volume:** 02 — ERP  
> **Estado:** ✅ Sprint ERP-9 — Concluído (Julho 2026)  
> **Depende de:** Volume 01 — CRM ✅ Concluído  
> **Roadmap completo:** [docs/roadmap/erp-roadmap.md](../roadmap/erp-roadmap.md)

---

## Visão

O **ERP Financeiro Integrado** transforma o Azul Coworking de um sistema de gestão operacional num **sistema financeiro completo**, com controlo de receitas, despesas, contratos, faturação, fluxo de caixa e reporting.

A filosofia central é a **integração total**: nenhum dado é inserido duas vezes. A `Company` continua a ser a única fonte de verdade. O Event Bus garante que todos os módulos se mantêm sincronizados de forma automática e auditável.

---

## Princípios Financeiros Invioláveis

```
1. LEDGER IMUTÁVEL     — nenhum lançamento financeiro é editado ou apagado
2. TRANSACÇÃO TOTAL    — toda operação multi-tabela usa prisma.$transaction()
3. NUMERAÇÃO ATÓMICA   — DocumentCounter com SELECT ... FOR UPDATE
4. AUDITORIA TOTAL     — toda alteração gera AuditLog
5. TIMELINE UNIVERSAL  — toda operação financeira gera TimelineEntry
6. SSoT COMPANY        — Company é sempre o pivot financeiro
7. EVENTO PÓS-PERSIST  — Event Bus é chamado APÓS commit da transacção
```

---

## Fluxo Obrigatório

```
Reserva Confirmada
  → Contrato / RentSchedule gerado
  → Fatura emitida (InvoiceGenerated)
  → Pagamento registado (PaymentReceived)
  → Ledger actualizado (LedgerEntry criado)
  → Timeline actualizada (TimelineEntry)
  → Dashboard actualizado (snapshot)
  → Alerta resolvido ou gerado
  → Email enviado via Resend
```

Tudo automático via Event Bus. Zero intervenção manual quando o fluxo segue o caminho feliz.

---

## Módulos

| # | Módulo | Documento | Estado |
|---|---|---|---|
| 1 | Domínio Financeiro | [finance-domain.md](./finance-domain.md) | ✅ Especificação concluída |
| 2 | Plano de Contas | [chart-of-accounts.md](./chart-of-accounts.md) | ✅ Especificação concluída |
| 3 | Modelo de Dados | [data-model.md](./data-model.md) | ✅ Implementado — ERP-1 |
| 4 | Contratos de Aluguer | [contracts-rent.md](./contracts-rent.md) | ✅ Implementado — ERP-2 |
| 5 | Faturação | [billing.md](./billing.md) | ✅ Implementado — ERP-2 |
| 6 | Pagamentos | [payments.md](./payments.md) | ✅ Implementado — ERP-3 |
| 7 | Despesas | [expenses.md](./expenses.md) | ✅ Implementado — ERP-4 |
| 8 | Centros de Custo | [cost-centers.md](./cost-centers.md) | ✅ Implementado — ERP-4 |
| 9 | Fluxo de Caixa | [cashflow.md](./cashflow.md) | ✅ Implementado — ERP-5 |
| 10 | Relatórios | [reports.md](./reports.md) | ✅ Implementado — ERP-9 |
| 11 | Alertas Financeiros | [alerts.md](./alerts.md) | ✅ Implementado — ERP-6 |
| 12 | Event Catalog | [financial-events.md](./financial-events.md) | ✅ Especificação concluída |
| 13 | API Reference | [api.md](./api.md) | 🚧 Actualização contínua |
| 14 | Migração | [migration.md](./migration.md) | ✅ Especificação concluída |
| 15 | Testes | [testing-strategy.md](./testing-strategy.md) | ✅ Especificação concluída |

---

## Entidades Principais

```
Contract          → Contrato de aluguer de posto de coworking
RentSchedule      → Parcelas mensais geradas pelo contrato
Invoice           → Fatura (unificada: coworking + salas + serviços)
InvoiceItem       → Item de fatura
Payment           → Pagamento registado
FinancialLedger   → Ledger imutável (double-entry)
Expense           → Despesa operacional
ExpenseCategory   → Categoria de despesa
CostCenter        → Centro de custo analítico
CashMovement      → Movimento de caixa (real ou projectado)
FinancialAlert    → Alerta financeiro (automático ou manual)
FinancialReportSnapshot → Snapshot de relatório financeiro
```

---

## KPIs do Dashboard Financeiro

| KPI | Descrição |
|---|---|
| **MRR** | Monthly Recurring Revenue (contratos activos) |
| **ARR** | MRR × 12 |
| **Receita Mensal** | Faturado no mês corrente |
| **Recebido** | Pagamentos confirmados no mês |
| **Inadimplência** | Valor em aberto > 30 dias |
| **Churn Financeiro** | Contratos rescindidos / total |
| **Ticket Médio** | Receita / clientes activos |
| **Lucro Operacional** | Receita − Despesas Operacionais |
| **Despesas Fixas** | Soma das despesas recorrentes |
| **Fluxo de Caixa** | Entradas − Saídas no período |
| **Projeção 90 dias** | Baseado em contratos e despesas confirmadas |

---

## ADRs do Volume 02

| ID | Decisão | Estado |
|---|---|---|
| [ADR-021](../adr/README.md#adr-021) | Ledger Imutável (append-only) | 📝 PROPOSTO |
| [ADR-022](../adr/README.md#adr-022) | Contract como entidade central de aluguer | 📝 PROPOSTO |
| [ADR-023](../adr/README.md#adr-023) | Separação Invoice / Payment / Ledger | 📝 PROPOSTO |
| [ADR-024](../adr/README.md#adr-024) | CostCenter como dimensão analítica plana | 📝 PROPOSTO |
| [ADR-025](../adr/README.md#adr-025) | CashFlow baseado em eventos (event-driven) | 📝 PROPOSTO |

---

## Roadmap de Sprints

| Sprint | Objectivo | Estado |
|---|---|---|
| **ERP-0** | Especificação completa | ✅ Concluído — Jul 2026 |
| **ERP-1** | Modelo de dados + Ledger | ✅ Concluído — Jul 2026 |
| **ERP-2** | Contratos e rendas | ✅ Concluído — Jul 2026 |
| **ERP-3** | Pagamentos (confirmação + recibo + ledger) | ✅ Concluído — Jul 2026 |
| **ERP-4** | Contas a receber / pagar (despesas + AR aging + AP) | ✅ Concluído — Jul 2026 |
| **ERP-5** | Fluxo de caixa (real + projectado + KPIs + reconciliação) | ✅ Concluído — Jul 2026 |
| **ERP-6** | Alertas automáticos (cron diário + 7 tipos + ciclo de vida) | ✅ Concluído — Jul 2026 |
| **ERP-7** | Dashboard financeiro (KPIs + P&L + MRR + snapshot) | ✅ Concluído — Jul 2026 |
| **ERP-8** | Comunicação financeira (PDFs + email + Cloudinary) | ✅ Concluído — Jul 2026 |
| **ERP-9** | Relatórios e BI | ✅ Concluído — Jul 2026 |

Ver detalhes: [docs/roadmap/erp-roadmap.md](../roadmap/erp-roadmap.md)

---

## Integrações

```
CRM             → Company como pivot; eventos CRM disparam fluxos financeiros
Reservas        → RoomBooking confirmada → Invoice gerada automaticamente
Contratos       → Contract.start → RentSchedule gerado; Contract.end → alerta
Pagamentos      → Payment.confirmed → Ledger entry + Receipt PDF
Comunicação     → Resend: faturas, recibos, alertas, lembretes
Event Bus       → publish() após cada transacção financeira
Dashboard       → FinancialReportSnapshot actualizado por cron / evento
```

---

*VD Platform — Volume 02 — ERP Financeiro Integrado*  
*Actualizado: Sprint ERP-9 concluído — Julho 2026*
