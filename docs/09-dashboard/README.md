# Volume 06 — Dashboard Executivo & Business Intelligence

> **Estado:** ✅ CONCLUÍDO — Sprint VOL06-4 (29 Julho 2026)  
> **Aprovado em:** 29 Julho 2026  
> **Concluído em:** 29 Julho 2026  
> **Arquiteto:** Claude (VD Platform)  
> **Pasta:** `docs/09-dashboard/`  
> **Pasta de código:** `src/app/admin/dashboard/`, `src/app/api/bi/`, `src/components/admin/`, `src/lib/bi-helpers.ts`

---

## 0. Contexto e Justificação

Com os Volumes 01–05 concluídos, a plataforma tem dados ricos em cinco domínios:

| Domínio | Dados disponíveis |
|---|---|
| CRM (VOL01) | Leads, pipeline, conversões, tarefas |
| ERP (VOL02) | Contratos, benefícios, cashflow, snapshots mensais |
| Portal (VOL03) | Actividade do cliente, acessos, cobrança automática |
| Reservas (VOL04) | Ocupação da sala, receita, cancelamentos |
| Segurança (VOL05) | Auditoria, sessões, eventos de sistema |

O dashboard actual (`/admin/dashboard`) é CRM-cêntrico e apresenta apenas totais estáticos. Não existe:
- Gráfico de receita mensal (12 meses)
- Taxa de ocupação da sala de reunião
- Funil de conversão de leads
- Visão consolidada de pagamentos pendentes vs confirmados
- Relatório executivo exportável

Este volume corrige essa lacuna sem novos modelos de schema — apenas novos endpoints de agregação e um UI renovado.

---

## 1. Objectivos

1. Substituir o dashboard estático por um **Dashboard Executivo** com gráficos interactivos.
2. Criar endpoints de **Business Intelligence** que agregam dados dos 5 domínios.
3. Adicionar **exportação de relatório mensal em PDF**.
4. **Reorganizar a navegação** lateral (Sidebar) para reflectir todos os módulos VOL01–05.

---

## 2. Regras de Negócio Aplicáveis

- **SSoT**: Todos os dados vêm directamente das tabelas existentes — nenhum dado é duplicado ou pré-calculado num novo modelo.
- **RBAC**: Endpoints `/api/bi/*` exigem `requireRole(["ADMIN", "FINANCEIRO"])`. Gráficos de CRM são visíveis a todos os roles.
- **Moeda**: Todos os valores monetários em AOA (Kz), sem conversão.
- **Fuso**: `Africa/Luanda` (UTC+1) em todos os agrupamentos por data.
- **Performance**: Endpoints BI usam `GROUP BY` no PostgreSQL (via Prisma `$queryRaw` ou `groupBy`) — nunca carregar todos os registos para agregar em memória.
- **Sem dados em cache no frontend**: O dashboard recarrega dados a cada visita; não usar `localStorage` para guardar métricas.

---

## 3. Sem Alterações ao Schema

Este volume **não adiciona novos modelos** ao `prisma/schema.prisma`. Todos os dados existem nas tabelas:

```
Payment, Invoice, Reservation, ReservationEvent,
Lead, Company, Task, CrmActivity, AuditLog, AdminSession
```

---

## 4. Arquitectura de Endpoints BI

Todos os endpoints ficam em `src/app/api/bi/`.

### 4.1 GET `/api/bi/revenue`

Parâmetros: `months=12` (default), `type=all|coworking|sala`

Devolve receita confirmada por mês (últimos N meses), separada por tipo.

```json
{
  "months": [
    { "month": "2025-08", "coworking": 450000, "sala": 120000, "total": 570000 },
    ...
  ],
  "totals": { "coworking": 5400000, "sala": 1440000, "total": 6840000 }
}
```

Fonte: `Payment` com `status = "CONFIRMADO"`, agrupado por `paidAt` truncado ao mês.

### 4.2 GET `/api/bi/occupancy`

Parâmetros: `months=12`

Taxa de ocupação da sala por mês (horas reservadas / horas disponíveis × 100).

```json
{
  "months": [
    { "month": "2025-08", "bookedHours": 48, "availableHours": 160, "rate": 30 },
    ...
  ],
  "avgRate": 34.2
}
```

Fonte: `Reservation` com `status != "CANCELADA"`, agrupado por `date` truncado ao mês.  
Horas disponíveis = dias úteis × 10h (configurable via env `ROOM_DAILY_HOURS`, default 10).

### 4.3 GET `/api/bi/leads`

Devolve funil de conversão e distribuição por estado.

```json
{
  "funnel": {
    "total": 142,
    "contactado": 89,
    "proposta": 34,
    "negociacao": 18,
    "convertido": 11,
    "perdido": 14
  },
  "conversionRate": 7.7,
  "avgDaysToConvert": 21
}
```

Fonte: `Lead`, `LeadActivity`, agrupado por `status`.

### 4.4 GET `/api/bi/payments-summary`

Resumo de pagamentos em aberto vs confirmados vs vencidos.

```json
{
  "pending": { "count": 8, "total": 320000 },
  "confirmed": { "count": 47, "total": 1880000 },
  "overdue": { "count": 3, "total": 120000 }
}
```

Fonte: `Payment`, filtrado por `status` e `dueDate`.

### 4.5 GET `/api/bi/kpis`

KPIs globais para os cards de topo do dashboard.

```json
{
  "activeCompanies": 23,
  "activeContracts": 19,
  "mrr": 680000,
  "pendingPayments": 3,
  "upcomingReservations": 5,
  "pendingDeleteRequests": 1
}
```

Fonte: Promise.all de múltiplas queries — substituição directa das 16 queries paralelas do dashboard actual.

### 4.6 GET `/api/bi/report/monthly?month=YYYY-MM`

Agregado completo do mês para exportação PDF.  
Acesso: `ADMIN` e `FINANCEIRO` apenas.

---

## 5. UI — Dashboard Executivo

### 5.1 Estrutura da página `/admin/dashboard`

O dashboard actual (230 linhas, CRM-cêntrico) é substituído por uma página com 3 secções:

```
┌─────────────────────────────────────────────────────────────┐
│  KPI Cards (6 cards)                                        │
│  Empresas activas · Contratos · MRR · Pagamentos pendentes  │
│  Reservas próximas · Aprovações pendentes                   │
├───────────────────────┬─────────────────────────────────────┤
│  Receita Mensal       │  Taxa de Ocupação da Sala           │
│  (Bar chart, 12m)     │  (Line chart, 12m)                  │
├───────────────────────┴─────────────────────────────────────┤
│  Funil CRM            │  Pagamentos — Estado Actual         │
│  (Funnel/bar chart)   │  (Donut chart)                      │
├───────────────────────┴─────────────────────────────────────┤
│  [Exportar Relatório Mensal PDF]  Mês: [selector]           │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Biblioteca de gráficos

**Recharts** (já disponível no projecto via npm). Sem novas dependências.

Componentes a criar:
- `src/components/admin/charts/RevenueChart.tsx` — BarChart receita por mês
- `src/components/admin/charts/OccupancyChart.tsx` — LineChart taxa de ocupação
- `src/components/admin/charts/LeadFunnelChart.tsx` — BarChart horizontal funil CRM
- `src/components/admin/charts/PaymentStatusChart.tsx` — PieChart/Donut estado pagamentos

### 5.3 Reorganização do Sidebar

Adicionar grupo **"Segurança"** no Sidebar (link Auditoria já foi adicionado no DoD VOL05, mas o agrupamento visual será feito neste volume):

```
Geral
  Dashboard  Leads  Convertidos  Leads Salas
  Empresas  Atividades  Pagamentos
  Sala de Reunião  Rel. Salas  Calendário
  Aprovações  Preços da Sala  Config. Sala

Segurança & Admin
  Definições  Auditoria

CRM Comercial
  CRM Dashboard  Empresas CRM  Kanban  As Minhas Tasks
```

---

## 6. Exportação PDF — Relatório Mensal

### 6.1 Conteúdo do relatório

Gerado por `/api/bi/report/monthly?month=YYYY-MM`, renderizado em HTML e convertido a PDF via `puppeteer` (server-side) ou `jsPDF` (client-side).

**Decisão de implementação:** `@react-pdf/renderer` (client-side, sem dependência de browser headless). Gera PDF directamente no browser e dispara download.

```
Relatório Executivo — Azul Coworking
Período: [Mês Ano]

1. Resumo Financeiro
   Receita Coworking: Kz X.XXX.XXX
   Receita Sala:      Kz X.XXX.XXX
   Total:             Kz X.XXX.XXX
   Pagamentos pendentes: N (Kz X.XXX.XXX)
   Pagamentos vencidos:  N (Kz X.XXX.XXX)

2. Operações — Sala de Reunião
   Reservas realizadas: N
   Horas reservadas: N h
   Taxa de ocupação: N%
   Receita sala: Kz X.XXX.XXX

3. CRM
   Novos leads: N
   Leads convertidos: N
   Taxa de conversão: N%
   Empresas activas: N

4. Nota de Rodapé
   Gerado em: [data/hora]
   Operador: VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA
   NIF: 5002174308
```

---

## 7. Backlog de Sprints

### Sprint VOL06-1 — Endpoints BI (2–3h)

| ID | Tarefa | Ficheiros |
|---|---|---|
| V06-001 | Criar `GET /api/bi/kpis` | `src/app/api/bi/kpis/route.ts` |
| V06-002 | Criar `GET /api/bi/revenue` | `src/app/api/bi/revenue/route.ts` |
| V06-003 | Criar `GET /api/bi/occupancy` | `src/app/api/bi/occupancy/route.ts` |
| V06-004 | Criar `GET /api/bi/leads` | `src/app/api/bi/leads/route.ts` |
| V06-005 | Criar `GET /api/bi/payments-summary` | `src/app/api/bi/payments-summary/route.ts` |
| V06-006 | Testes unitários dos endpoints BI | `src/__tests__/unit/bi-*.test.ts` |

### Sprint VOL06-2 — Componentes de gráfico (2–3h)

| ID | Tarefa | Ficheiros |
|---|---|---|
| V06-007 | `RevenueChart` — BarChart receita 12m | `src/components/admin/charts/RevenueChart.tsx` |
| V06-008 | `OccupancyChart` — LineChart ocupação 12m | `src/components/admin/charts/OccupancyChart.tsx` |
| V06-009 | `LeadFunnelChart` — BarChart horizontal | `src/components/admin/charts/LeadFunnelChart.tsx` |
| V06-010 | `PaymentStatusChart` — Donut estado | `src/components/admin/charts/PaymentStatusChart.tsx` |
| V06-011 | `KpiCard` — card reutilizável com ícone/valor/delta | `src/components/admin/KpiCard.tsx` |

### Sprint VOL06-3 — Dashboard UI renovado (2–3h)

| ID | Tarefa | Ficheiros |
|---|---|---|
| V06-012 | Substituir `/admin/dashboard/page.tsx` por layout em 3 secções | `src/app/admin/dashboard/page.tsx` |
| V06-013 | Reorganizar Sidebar — grupo "Segurança & Admin" | `src/components/admin/Sidebar.tsx` |
| V06-014 | Selector de intervalo de datas no dashboard | `src/components/admin/DateRangePicker.tsx` |
| V06-015 | Loading skeletons para cada gráfico | `src/components/admin/charts/ChartSkeleton.tsx` |

### Sprint VOL06-4 — Relatório PDF Mensal (2–3h)

| ID | Tarefa | Ficheiros |
|---|---|---|
| V06-016 | Criar `GET /api/bi/report/monthly` | `src/app/api/bi/report/monthly/route.ts` |
| V06-017 | Componente `MonthlyReportPdf` com `@react-pdf/renderer` | `src/components/admin/MonthlyReportPdf.tsx` |
| V06-018 | Botão "Exportar PDF" no dashboard, com selector de mês | integrado em `page.tsx` |
| V06-019 | Testes de integração do relatório PDF | `src/__tests__/unit/bi-report.test.ts` |

---

## 8. Ficheiros Afectados

| Ficheiro | Operação | Sprint |
|---|---|---|
| `src/app/api/bi/kpis/route.ts` | NOVO | VOL06-1 |
| `src/app/api/bi/revenue/route.ts` | NOVO | VOL06-1 |
| `src/app/api/bi/occupancy/route.ts` | NOVO | VOL06-1 |
| `src/app/api/bi/leads/route.ts` | NOVO | VOL06-1 |
| `src/app/api/bi/payments-summary/route.ts` | NOVO | VOL06-1 |
| `src/app/api/bi/report/monthly/route.ts` | NOVO | VOL06-4 |
| `src/app/admin/dashboard/page.tsx` | SUBSTITUIÇÃO | VOL06-3 |
| `src/components/admin/Sidebar.tsx` | EDIÇÃO (reorganização grupos) | VOL06-3 |
| `src/components/admin/charts/RevenueChart.tsx` | NOVO | VOL06-2 |
| `src/components/admin/charts/OccupancyChart.tsx` | NOVO | VOL06-2 |
| `src/components/admin/charts/LeadFunnelChart.tsx` | NOVO | VOL06-2 |
| `src/components/admin/charts/PaymentStatusChart.tsx` | NOVO | VOL06-2 |
| `src/components/admin/KpiCard.tsx` | NOVO | VOL06-2 |
| `src/components/admin/DateRangePicker.tsx` | NOVO | VOL06-3 |
| `src/components/admin/MonthlyReportPdf.tsx` | NOVO | VOL06-4 |
| `src/__tests__/unit/bi-*.test.ts` | NOVO | VOL06-1 |
| `src/__tests__/unit/bi-report.test.ts` | NOVO | VOL06-4 |
| `package.json` | EDIÇÃO (adicionar `@react-pdf/renderer`) | VOL06-4 |

**Schema:** sem alterações ao `prisma/schema.prisma`.  
**Migrações:** nenhuma.

---

## 9. Dependências Novas

| Pacote | Versão | Justificação | Aprovação necessária |
|---|---|---|---|
| `@react-pdf/renderer` | `^3.x` | Geração PDF client-side, sem puppeteer | ✅ Incluído na proposta |
| `recharts` | já instalado | Gráficos — sem nova dependência | — |

---

## 10. Critérios de Aceitação (DoD VOL06)

```
□ GET /api/bi/kpis devolve os 6 KPIs em < 200ms (query único com Promise.all)
□ GET /api/bi/revenue devolve array de 12 meses com valores coworking + sala
□ GET /api/bi/occupancy devolve taxa de ocupação por mês e média anual
□ GET /api/bi/leads devolve funil completo e taxa de conversão
□ GET /api/bi/payments-summary devolve pending/confirmed/overdue
□ Dashboard exibe 6 KPI cards, 4 gráficos e botão de exportação PDF
□ Gráfico de receita distingue visualmente coworking vs sala (barras empilhadas ou agrupadas)
□ PDF gerado inclui todos os 3 secções (financeiro, sala, CRM) com dados do mês seleccionado
□ Sidebar reorganizado com grupo "Segurança & Admin" visível apenas para ADMIN
□ Todos os endpoints testados (testes unitários com mocks Prisma)
□ tsc --noEmit sem erros em todos os ficheiros novos
□ Quality Gate 1 e 2 passam
```

---

## 11. Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Queries de agregação lentas com muitos registos | Baixa (dados actuais pequenos) | Índice em `Payment.paidAt`, `Reservation.date` (já existem) |
| `@react-pdf/renderer` incompatível com Next.js 15 App Router | Média | Usar `dynamic(() => import(...), { ssr: false })` para o componente PDF |
| Recharts não responsivo em mobile | Baixa | `ResponsiveContainer` wraps todos os charts |
| Dados de ocupação inconsistentes para meses sem reservas | Baixa | Preencher meses com 0 no endpoint, não omitir |

---

## 12. Estado Final — CONCLUÍDO

| Item | Estado |
|---|---|
| Proposta técnica | ✅ Aprovada |
| Aprovação PO | ✅ 29 Jul 2026 |
| VOL06-1 — Endpoints BI | ✅ Concluído |
| VOL06-2 — Componentes Gráfico | ✅ Concluído |
| VOL06-3 — Dashboard UI + Sidebar | ✅ Concluído |
| VOL06-4 — Relatório PDF Mensal | ✅ Concluído |
| Testes (16 assertions bi-helpers) | ✅ Passam |
| tsc --noEmit sem erros | ✅ Validado |
| ADR-036 criado | ✅ |
| CLAUDE.md actualizado | ✅ |
| docs/README.md actualizado | ✅ |

---

## 13. Entregáveis

| Ficheiro | Tipo | Sprint |
|---|---|---|
| `src/lib/bi-helpers.ts` | NOVO — helpers puros BI | VOL06-1 |
| `src/app/api/bi/kpis/route.ts` | NOVO | VOL06-1 |
| `src/app/api/bi/revenue/route.ts` | NOVO | VOL06-1 |
| `src/app/api/bi/occupancy/route.ts` | NOVO | VOL06-1 |
| `src/app/api/bi/leads/route.ts` | NOVO | VOL06-1 |
| `src/app/api/bi/payments-summary/route.ts` | NOVO | VOL06-1 |
| `src/__tests__/unit/bi-helpers.test.ts` | NOVO — 16 assertions | VOL06-1 |
| `src/components/admin/KpiCard.tsx` | NOVO | VOL06-2 |
| `src/components/admin/charts/ChartSkeleton.tsx` | NOVO | VOL06-2 |
| `src/components/admin/charts/RevenueChart.tsx` | NOVO | VOL06-2 |
| `src/components/admin/charts/OccupancyChart.tsx` | NOVO | VOL06-2 |
| `src/components/admin/charts/LeadFunnelChart.tsx` | NOVO | VOL06-2 |
| `src/components/admin/charts/PaymentStatusChart.tsx` | NOVO | VOL06-2 |
| `src/app/admin/dashboard/page.tsx` | SUBSTITUIÇÃO | VOL06-3 |
| `src/components/admin/Sidebar.tsx` | EDIÇÃO — grupo "Segurança & Admin" | VOL06-3 |
| `src/app/api/bi/report/monthly/route.ts` | NOVO | VOL06-4 |
| `src/components/admin/MonthlyReportPdf.tsx` | NOVO | VOL06-4 |
| `docs/adr/ADR-036-bi-dashboard-architecture.md` | NOVO | VOL06-docs |

---

*VD Platform — Volume 06 — v1.0 CONCLUÍDO — 29 Julho 2026*
