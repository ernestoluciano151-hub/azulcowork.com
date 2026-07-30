# ERP — Relatórios Financeiros

> **Volume:** 02 — ERP  
> **Estado:** ✅ Implementado — Sprint ERP-9 (29 Jul 2026)

---

## 1. Relatórios Disponíveis

### R-01 — Dashboard Financeiro (Tempo Real)

**Actualização:** em tempo real (sem cache) ou com cache de 5 minutos.

KPIs:
- MRR (Monthly Recurring Revenue)
- ARR (MRR × 12)
- Receita do mês corrente (faturado)
- Recebido no mês (pagamentos confirmados)
- Inadimplência (valor em aberto > 30 dias)
- Churn financeiro (contratos rescindidos / total)
- Ticket médio (receita / clientes activos)
- Lucro operacional (receita − despesas operacionais)
- Despesas fixas mensais
- Saldo de caixa actual
- Projecção 90 dias

---

### R-02 — Demonstração de Resultados (P&L)

**Período:** mensal, trimestral, anual  
**Formato:** tabela + gráfico de barras

```
PROVEITOS
  Mensalidades Coworking     Kz  850.000
  Salas de Reunião           Kz  220.000
  Serviços Adicionais        Kz   75.000
  ─────────────────────────────────────
  Total Proveitos            Kz 1.145.000

CUSTOS OPERACIONAIS
  Renda Imóvel               Kz  450.000
  Electricidade              Kz   45.000
  Água                       Kz   12.000
  Internet                   Kz   18.000
  Limpeza                    Kz   35.000
  Segurança                  Kz   40.000
  ─────────────────────────────────────
  Total Custos Operacionais  Kz  600.000

MARGEM BRUTA                 Kz  545.000  (47,6%)

CUSTOS COM PESSOAL
  Salários                   Kz  320.000
  INSS e Encargos            Kz   48.000
  ─────────────────────────────────────
  Total Pessoal              Kz  368.000

DESPESAS GERAIS
  Marketing                  Kz   80.000
  TI                         Kz   60.000
  Admin                      Kz   50.000
  ─────────────────────────────────────
  Total Despesas Gerais      Kz  190.000

EBIT (Lucro Operacional)     Kz  (13.000)

RESULTADO FINANCEIRO         Kz    5.000
─────────────────────────────────────────
RESULTADO ANTES IMPOSTOS     Kz   (8.000)
```

---

### R-03 — Balancete Mensal

Listagem de todas as contas do plano de contas com saldo devedor e credor do período.

---

### R-04 — Contas a Receber (Aging Report)

```
Empresa          | 0–30d  | 31–60d | 61–90d | +90d  | Total
Empresa Alpha    | 45.000 |    —   |    —   |   —   | 45.000
Empresa Beta     |    —   | 32.000 |    —   |   —   | 32.000
Empresa Gamma    |    —   |    —   | 15.000 |   —   | 15.000
─────────────────────────────────────────────────────────────
Total            | 45.000 | 32.000 | 15.000 |   —   | 92.000
```

---

### R-05 — Contas a Pagar

Lista de despesas pendentes por vencimento, agrupadas por categoria.

---

### R-06 — Fluxo de Caixa (Cash Flow Statement)

Já descrito em `cashflow.md`. Disponível como relatório exportável (PDF/Excel).

---

### R-07 — MRR Breakdown

Evolução do MRR mês a mês, com decomposição:
- MRR novo (novos contratos)
- MRR de expansão (upgrades)
- MRR contraído (downgrades)
- MRR perdido (churned)
- MRR líquido

---

### R-08 — Relatório de Inadimplência

```
Total em aberto:    Kz 92.000 (8% da receita)
Empresas em atraso: 3 de 22 activas
Valor médio:        Kz 30.667
Mais antigo:        Empresa Gamma — 67 dias
```

---

### R-09 — Relatório de Despesas por Centro de Custo

Comparação real vs. orçado por centro de custo, para o período seleccionado.

---

### R-10 — Relatório de Contratos

```
Estado        | Qtd | MRR Total
ACTIVE        |  18 | Kz 945.000
SUSPENDED     |   2 | Kz  85.000
DRAFT         |   3 |    —
TERMINATED    |   4 |    —
─────────────────────────────────
Total activos |  18 | Kz 945.000
```

Inclui tabela com contratos a expirar nos próximos 60/90 dias.

---

## 2. Formato de Exportação

Todos os relatórios devem ser exportáveis em:
- **PDF** (para partilha com stakeholders / contabilista)
- **Excel/CSV** (para análise externa)

---

## 3. FinancialReportSnapshot

Os relatórios mensais são guardados em `FinancialReportSnapshot` no final de cada mês (cron):

```
{ period: "2026-07", type: "MONTHLY", data: { mrr, arr, revenue, expenses, profit, ... } }
```

Estes snapshots permitem comparação histórica mesmo que os dados subjacentes mudem (e.g., após rectificações).

---

## 4. RBAC dos Relatórios

| Relatório | ADMIN | FINANCEIRO | COMERCIAL | VIEWER |
|---|---|---|---|---|
| R-01 Dashboard | ✅ | ✅ | Parcial¹ | ✅ |
| R-02 P&L | ✅ | ✅ | ❌ | ❌ |
| R-03 Balancete | ✅ | ✅ | ❌ | ❌ |
| R-04 AR Aging | ✅ | ✅ | Próprios² | ❌ |
| R-05 AP | ✅ | ✅ | ❌ | ❌ |
| R-06 CashFlow | ✅ | ✅ | ❌ | ❌ |
| R-07 MRR | ✅ | ✅ | ❌ | ❌ |
| R-08 Inadimplência | ✅ | ✅ | ❌ | ❌ |
| R-09 CostCenter | ✅ | ✅ | ❌ | ❌ |
| R-10 Contratos | ✅ | ✅ | Próprios² | ✅ |

¹ COMERCIAL vê KPIs agregados sem valores financeiros absolutos  
² COMERCIAL vê apenas clientes que lhe estão atribuídos

---

## 5. Implementação — Sprint ERP-7

### Serviço: `src/lib/erp-dashboard-service.ts`

| Função | Relatório | API Route |
|---|---|---|
| `getDashboardKpis()` | R-01 Dashboard | `GET /api/erp/dashboard` |
| `getPnl(period?)` | R-02 P&L + R-03 Balancete | `GET /api/erp/reports/pnl` |
| `getMrrBreakdown(months)` | R-07 MRR breakdown | `GET /api/erp/reports/mrr` |
| `getDelinquencyReport()` | R-08 Inadimplência | `GET /api/erp/reports/delinquency` |
| `getCostCenterReport(period?)` | R-09 CostCenter real vs. orçado | `GET /api/erp/reports/cost-centers` |
| `getContractsSummary()` | R-10 Contratos | `GET /api/erp/reports/contracts` |
| `generateMonthlySnapshot(period?)` | Snapshot cron | `GET /api/cron/erp-monthly-snapshot` |

### Cron mensal

```
schedule: "0 22 28-31 * *"   — dias 28–31, 23h00 Africa/Luanda
endpoint:  GET /api/cron/erp-monthly-snapshot
authn:     Authorization: Bearer ${CRON_SECRET}
upsert:    FinancialReportSnapshot.period_type (@@unique[period, type])
```

### Testes unitários

`src/__tests__/unit/erp-dashboard-service.test.ts` — 37 testes cobrindo:
MRR/ARR, churn rate, ticket médio, delinquency rate, gross margin %,
EBIT, MRR net breakdown, partida dupla equilibrada, CostCenter status.

---

## 6. Implementação — Sprint ERP-9

### Novos Serviços

| Serviço | Responsabilidade |
|---|---|
| `src/lib/erp-vat-report-service.ts` | R-07bis: apuramento IVA mensal Angola (2311 / 2312) |
| `src/lib/erp-reconciliation-service.ts` | R-05bis: reconciliação CashMovement vs Payments/Expenses |
| `src/lib/erp-export-service.ts` | Exportação XLSX/CSV (6 tipos de relatório) |

### API Routes

| Route | Descrição |
|---|---|
| `GET /api/erp/reports/vat` | IVA mensal — `?period=YYYY-MM&history=true&months=6` |
| `GET /api/erp/reports/reconciliation` | Reconciliação — `?period=YYYY-MM&bankAccount=BCS-MAIN` |
| `GET /api/erp/reports/export` | Exportação — `?type=pnl\|aging\|mrr\|vat\|cost-centers\|delinquency&format=xlsx\|csv` |

### IVA Angola (R-07bis)

- Taxa: **14%** (Lei n.º 17/19)
- Conta 2311 (CREDIT) → IVA liquidado (cobrado a clientes)
- Conta 2312 (DEBIT) → IVA dedutível (pago a fornecedores)
- `vatBalance = outputVat − inputVat`; positivo → pagar ao Estado (DUE); negativo → crédito (CREDIT)
- `baseAmount` calculado inversamente: `Math.round(entry.amount / IVA_RATE)`
- Histórico de tendência via `getVatHistory(months)` — agrega por mês

### Reconciliação Bancária (R-05bis)

- `RECONCILIATION_THRESHOLD = 1.000 Kz` — discrepância acima disto → MISMATCH
- Compara CashMovement (reais, não projectados) vs ErpPayments CONFIRMED e ErpExpenses PAID
- `openingBalance` = último CashMovement antes do período
- `closingBalance` = último CashMovement no período
- `isBalanced = true` apenas se todas as linhas estiverem OK

### Exportação (XLSX / CSV)

| Tipo | Conteúdo |
|---|---|
| `pnl` | P&L multi-secção: Proveitos, Custos Op., Pessoal, Gerais, EBIT |
| `aging` | AR aging: Corrente, 1–30d, 31–60d, 61–90d, +90d, Total |
| `mrr` | MRR breakdown: Novo, Churn, Net, Total (evolução mensal) |
| `vat` | 3 folhas: Resumo IVA, IVA Liquidado, IVA Dedutível |
| `cost-centers` | CostCenter real vs. orçado com cor (CRITICAL/WARNING/OK) |
| `delinquency` | Inadimplência por empresa com valor em aberto e dias mais antigo |

- CSV usa `wb.csv.writeBuffer()` (1ª folha); XLSX usa `wb.xlsx.writeBuffer()`
- Resposta binária com `Content-Disposition: attachment` para download directo

### Testes unitários

`src/__tests__/unit/erp-reports-service.test.ts` — 42 testes cobrindo:
IVA apuramento, taxa Angola, cálculo inverso de base, vatStatus (DUE/CREDIT/ZERO),
reconciliation threshold, detecção MISMATCH, discrepância absoluta, isBalanced,
contentType XLSX/CSV, filename com/sem período.

---

*VD Platform — ERP — Relatórios — Sprint ERP-9 — 29 Jul 2026*
