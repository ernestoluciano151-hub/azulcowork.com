# Executive Summary — Volume 02: ERP Financeiro Integrado

> **Documento:** Executive Summary — Sprint ERP-0  
> **Data:** 28 Julho 2026  
> **Autor:** Claude (Arquiteto-Chefe VD Platform)  
> **Para:** Ernesto Pinto Luciano (Product Owner)  
> **Estado:** 📋 Aguarda aprovação antes de qualquer implementação

---

## 1. Visão do ERP

O **Volume 02 — ERP Financeiro Integrado** transforma o Azul Coworking de um sistema de gestão operacional num **sistema financeiro completo e automatizado**, eliminando trabalho manual, reduzindo erros e dando ao operador visibilidade total sobre a saúde financeira do negócio em tempo real.

O ERP não é um módulo isolado — é uma **extensão natural do CRM**: a `Company` continua a ser a única fonte de verdade; os contratos, faturas, pagamentos e alertas gravitam em torno dela. Nenhum dado é inserido duas vezes.

---

## 2. Arquitectura Financeira

### Modelo de Três Camadas

```
Camada de Negócio   →  Contract / Invoice / Expense / Payment
Camada Analítica    →  CostCenter / CashMovement / FinancialAlert
Camada Contabilística →  FinancialLedger (imutável, partida dupla)
```

### Princípios Invioláveis

| # | Princípio | Implementação |
|---|---|---|
| 1 | **Ledger imutável** | Sem UPDATE/DELETE em FinancialLedger; estorno por novo lançamento |
| 2 | **Partida dupla** | Cada operação gera DEBIT + CREDIT de igual valor |
| 3 | **Transacção total** | Toda operação multi-tabela em `prisma.$transaction()` |
| 4 | **Numeração atómica** | DocumentCounter com SELECT FOR UPDATE |
| 5 | **Evento pós-commit** | Event Bus chamado após commit, com `.catch(() => {})` |
| 6 | **SSoT Company** | Company é sempre o pivot financeiro |
| 7 | **Auditoria total** | Toda operação gera AuditLog + TimelineEntry |

### IVA Angola

Taxa: **14%** (Lei n.º 17/19). Aplicada automaticamente em todas as faturas. Contas `2311` (IVA a pagar) e `2312` (IVA dedutível) para apuramento mensal.

---

## 3. Principais Entidades (12 novos modelos)

| Entidade | Propósito | Tipo |
|---|---|---|
| `Contract` | Contrato de aluguer de coworking | Central |
| `RentSchedule` | Parcelas mensais geradas pelo contrato | Derivado |
| `Invoice` | Fatura unificada (coworking + salas + serviços) | Expansão |
| `InvoiceItem` | Item de fatura com código contabilístico | Novo |
| `Payment` | Pagamento registado e confirmado | Expansão |
| `FinancialLedger` | Razão geral imutável (partida dupla) | Crítico |
| `Expense` | Despesa operacional | Novo |
| `ExpenseCategory` | Categorias de despesa (14 tipos) | Referência |
| `CostCenter` | Centro de custo analítico (9 centros) | Referência |
| `CashMovement` | Movimento de caixa real ou projectado | Novo |
| `FinancialAlert` | Alerta financeiro automático ou manual | Novo |
| `FinancialReportSnapshot` | Snapshot mensal de relatório financeiro | Novo |

---

## 4. Fluxos Críticos

### Fluxo 1 — Activação de Contrato e Faturação Recorrente

```
Deal WON (CRM)
  → ADMIN cria Contract (DRAFT)
  → ADMIN activa → RentSchedules gerados (12 meses)
  → Cron dia 25 → Invoice ISSUED → PDF → Email (Resend)
  → Cliente paga → ADMIN confirma → Ledger → Recibo → Timeline
```

**Automação completa** após activação do contrato.

### Fluxo 2 — Reserva de Sala → Fatura Automática

```
RoomBooking CONFIRMED
  → Event Bus: booking.confirmed
  → Handler ERP: gera Invoice tipo ROOM automaticamente
  → PDF gerado → Email enviado
  → Pagamento registado e confirmado
```

**Zero intervenção manual** no caminho feliz.

### Fluxo 3 — Despesa Operacional

```
ADMIN regista Expense
  → Se > Kz 50.000: aguarda aprovação ADMIN
  → Se ≤ Kz 50.000: auto-aprovada
  → Paga → Ledger (DEBIT 6xxx, CREDIT 1201)
  → CashMovement OUTFLOW
  → Comparação com budget → FinancialAlert se excedido
```

### Fluxo 4 — Alerta de Inadimplência

```
Invoice dueDate + 1 dia → PAYMENT_OVERDUE (WARNING)
  → Email lembrete ao cliente
  → dueDate + 30 dias → CRITICAL + email ADMIN
  → Pagamento confirmado → Alerta resolvido automaticamente
```

---

## 5. KPIs do Dashboard Financeiro

| KPI | Cálculo |
|---|---|
| **MRR** | Soma de `Contract.monthlyValue` de contratos ACTIVE |
| **ARR** | MRR × 12 |
| **Receita Mensal** | Soma de `Invoice.total` emitidas no mês |
| **Recebido** | Soma de `Payment.amount` confirmados no mês |
| **Inadimplência** | Valor de Invoices OVERDUE / Receita total × 100 |
| **Churn Financeiro** | Contratos TERMINATED no mês / total activos |
| **Ticket Médio** | MRR / número de clientes activos |
| **Lucro Operacional** | Receita − Despesas Operacionais (OPERACIONAL + RH) |
| **Despesas Fixas** | Soma de Expenses recorrentes aprovadas |
| **Saldo de Caixa** | Último `CashMovement.balance` com `isProjected=false` |
| **Projecção 90 dias** | Saldo actual + INFLOW projectado − OUTFLOW projectado |

---

## 6. Integrações

| Sistema | Direcção | Integração |
|---|---|---|
| **CRM** (Company) | Bidirecional | Company é o pivot de todos os documentos financeiros |
| **CRM** (Deal) | CRM → ERP | `deal.won` notifica equipa para criar contrato |
| **Reservas** (RoomBooking) | BOOK → ERP | `booking.confirmed` gera Invoice ROOM automaticamente |
| **Event Bus** | Bidirecional | Todos os eventos ERP publicados via `publish()` |
| **DocumentCounter** | ERP usa | Numeração FT-CWORK, FT-SALA, REC, NL |
| **Cloudinary** | ERP usa | Storage de PDFs de faturas e recibos |
| **Resend** | ERP → Email | Faturas, recibos, lembretes, alertas, contratos |
| **Timeline** | ERP → CRM | Toda operação financeira gera TimelineEntry na Company |

---

## 7. Plano de Contas

Baseado no **PGC Angola**, com 9 centros de custo e 35+ contas activas:

- **Receitas:** contas 711x (coworking), 712x (salas), 713x (serviços)
- **Despesas:** contas 6111–6611 (operacionais, RH, marketing, TI, admin)
- **IVA:** contas 2311/2312 (apuramento mensal)
- **Caixa/Banco:** conta 1201 (BCS — conta corrente principal)

---

## 8. Riscos e Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R-01 | **Dados históricos inconsistentes** — Invoices e Payments existentes sem campos ERP | Alta | Médio | Script de migração com dry-run + validação pós-migração |
| R-02 | **Race conditions na numeração** — DocumentCounter em chamadas paralelas | Média | Alto | `SELECT ... FOR UPDATE` já implementado na Fase P0 |
| R-03 | **Falha no envio de email** — Resend temporariamente indisponível | Média | Médio | Retry automático; evento `erp.invoice.sent` publicado após sucesso |
| R-04 | **IVA calculado incorrectamente** — arredondamentos em AOA | Baixa | Alto | Testes unitários com 50+ casos de borda; arredondamento a 0 casas |
| R-05 | **Ledger inconsistente** — handler falha após commit de Invoice | Baixa | Crítico | `$transaction` garante atomicidade; Event Bus com `.catch(() => {})` |
| R-06 | **Cron job falha silenciosamente** — faturação mensal não executada | Baixa | Alto | Monitoring via Sentry; alerta se cron não executar em 24h |
| R-07 | **Conflito de schema** — novas colunas em Invoice/Payment quebram código existente | Média | Alto | Todas as colunas novas com `DEFAULT`; rollback de migration testado |
| R-08 | **Complexidade de migração** — dados de contratos não estruturados | Alta | Médio | Migração manual assistida + seed de dados de referência |

---

## 9. Plano de Migração (Resumo)

**Fase 1 — Schema (Sprint ERP-1, sem downtime):**
- Novas tabelas com `DEFAULT` em colunas FK
- Expansão de Invoice e Payment com campos retrocompatíveis
- Seed de CostCenters e ExpenseCategories

**Fase 2 — Dados Históricos (Sprint ERP-1, com script):**
- Script `migrate-financial-history.ts` com `--dry-run`
- Cálculo de `subtotal`/`taxAmount` para Invoices existentes
- Criação de CashMovements para Payments confirmados

**Fase 3 — Migração Manual de Contratos:**
- Revisão com Ernesto das empresas activas e seus planos
- Criação manual de Contracts via interface admin
- Geração de RentSchedules pendentes

---

## 10. Roadmap de Implementação

| Sprint | Objectivo | Duração | Dependência |
|---|---|---|---|
| **ERP-1** | Schema Prisma + Contract + RentSchedule + Migration | 1 semana | Aprovação PO |
| **ERP-2** | Invoice + InvoiceItem + Billing Engine (numeração, IVA, PDF) | 1 semana | ERP-1 |
| **ERP-3** | Payment + FinancialLedger (partida dupla) + Recibo | 1 semana | ERP-2 |
| **ERP-4** | Expense + CostCenter + ExpenseCategory | 3 dias | ERP-3 |
| **ERP-5** | CashFlow + CashMovement + Projecções | 3 dias | ERP-4 |
| **ERP-6** | FinancialAlert + Cron Jobs + Notificações Resend | 3 dias | ERP-5 |
| **ERP-7** | FinancialReportSnapshot + Reports API + Dashboard API | 1 semana | ERP-6 |
| **ERP-8** | Frontend: Dashboard ERP + Contratos + Faturas + Despesas | 2 semanas | ERP-7 |
| **ERP-9** | Testes completos + QA + Smoke Tests + Documentação final | 1 semana | ERP-8 |

**Total estimado:** ~9 semanas  
**Início previsto:** Agosto 2026 (após aprovação deste summary)  
**Conclusão prevista:** Outubro 2026

---

## 11. Documentação Produzida (Sprint ERP-0)

| Documento | Localização | Estado |
|---|---|---|
| Índice do Volume | `docs/05-erp/README.md` | ✅ Concluído |
| Domínio Financeiro | `docs/05-erp/finance-domain.md` | ✅ Concluído |
| Plano de Contas (PGC Angola) | `docs/05-erp/chart-of-accounts.md` | ✅ Concluído |
| Modelo de Dados (Prisma) | `docs/05-erp/data-model.md` | ✅ Concluído |
| Contratos de Aluguer | `docs/05-erp/contracts-rent.md` | ✅ Concluído |
| Faturação | `docs/05-erp/billing.md` | ✅ Concluído |
| Pagamentos | `docs/05-erp/payments.md` | ✅ Concluído |
| Despesas | `docs/05-erp/expenses.md` | ✅ Concluído |
| Centros de Custo | `docs/05-erp/cost-centers.md` | ✅ Concluído |
| Fluxo de Caixa | `docs/05-erp/cashflow.md` | ✅ Concluído |
| Relatórios | `docs/05-erp/reports.md` | ✅ Concluído |
| Alertas Financeiros | `docs/05-erp/alerts.md` | ✅ Concluído |
| Event Catalog | `docs/05-erp/financial-events.md` | ✅ Concluído |
| API Reference | `docs/05-erp/api.md` | ✅ Concluído |
| Migração | `docs/05-erp/migration.md` | ✅ Concluído |
| Estratégia de Testes | `docs/05-erp/testing-strategy.md` | ✅ Concluído |
| Diagrama: Modelo de Dados | `docs/05-erp/diagrams/erp-data-model.mermaid` | ✅ Concluído |
| Diagrama: Fluxo de Receita | `docs/05-erp/diagrams/erp-revenue-flow.mermaid` | ✅ Concluído |
| Diagrama: Ciclo de Vida Contrato | `docs/05-erp/diagrams/erp-contract-lifecycle.mermaid` | ✅ Concluído |
| Diagrama: Lançamentos Ledger | `docs/05-erp/diagrams/erp-ledger-entries.mermaid` | ✅ Concluído |
| Diagrama: Mapa de Integrações | `docs/05-erp/diagrams/erp-integrations.mermaid` | ✅ Concluído |
| ADR-021: Ledger Imutável | `docs/adr/README.md#adr-021` | ✅ Concluído |
| ADR-022: Contract Central | `docs/adr/README.md#adr-022` | ✅ Concluído |
| ADR-023: Separação Invoice/Payment/Ledger | `docs/adr/README.md#adr-023` | ✅ Concluído |
| ADR-024: CostCenter Plano | `docs/adr/README.md#adr-024` | ✅ Concluído |
| ADR-025: CashFlow Event-Driven | `docs/adr/README.md#adr-025` | ✅ Concluído |

**Total: 26 documentos produzidos no Sprint ERP-0.**

---

## 12. Decisão Necessária

O Sprint ERP-0 está **concluído**. Toda a especificação funcional e técnica do ERP Financeiro Integrado foi produzida.

**Nenhum código foi escrito.** A implementação aguarda aprovação formal.

Para avançar para o Sprint ERP-1, é necessária:

> ✅ **Aprovação do Product Owner** para início da implementação do Volume 02 — ERP Financeiro Integrado.

Após aprovação, o próximo passo é o **Sprint ERP-1: Schema Prisma + Contract + RentSchedule + Migration**.

---

*VD Platform — Executive Summary — Volume 02 — ERP Financeiro Integrado*  
*Sprint ERP-0 concluído em 28 Julho 2026*
