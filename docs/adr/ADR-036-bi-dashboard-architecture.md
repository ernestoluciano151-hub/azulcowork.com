# ADR-036 — Arquitectura BI: Endpoints de Agregação + Gráficos Client-Side + PDF via @react-pdf/renderer

**Estado:** ✅ ACEITE  
**Data:** 2026-07-29  
**Volume:** VOL06 — Dashboard Executivo & Business Intelligence  
**Decisores:** Claude (Arquiteto-Chefe), Ernesto Pinto Luciano (Product Owner)

---

## Contexto

O Volume 06 introduz um Dashboard Executivo consolidado que agrega dados de 5 domínios (CRM, ERP, Portal, Reservas, Segurança). Foi necessário decidir:

1. Onde colocar a lógica de agregação (server-side vs client-side)
2. Como estruturar os endpoints de Business Intelligence
3. Como renderizar os gráficos (SSR vs client-only)
4. Como gerar o relatório PDF mensal (server-side vs client-side)

---

## Decisões

### Decisão 1 — Endpoints BI dedicados em `/api/bi/`

**Decisão:** Criar endpoints de agregação separados em `src/app/api/bi/` em vez de:
- (a) Embutir as queries directamente na page.tsx
- (b) Reutilizar os endpoints ERP existentes

**Razão:** Os endpoints ERP (`/api/erp/dashboard`, `/api/erp/cashflow`) operam sobre os modelos VOL02 (`ErpContract`, `ErpInvoice`, `ErpPayment`) e não sobre os modelos base (`Payment`, `Reservation`, `Lead`). O Dashboard Executivo precisa de uma vista consolidada dos dois sistemas. Criar `/api/bi/` como camada de agregação separada respeita o SSoT — cada endpoint BI lê das tabelas autoritativas sem duplicar dados.

**Ficheiros afectados:**
```
src/app/api/bi/kpis/route.ts
src/app/api/bi/revenue/route.ts
src/app/api/bi/occupancy/route.ts
src/app/api/bi/leads/route.ts
src/app/api/bi/payments-summary/route.ts
src/app/api/bi/report/monthly/route.ts
```

### Decisão 2 — Gráficos como Client Components com fetch próprio

**Decisão:** Cada componente de gráfico (`RevenueChart`, `OccupancyChart`, etc.) é um Client Component que faz o seu próprio `fetch` ao endpoint BI correspondente. A page.tsx do dashboard permanece Server Component para os KPI cards e dados iniciais.

**Alternativa rejeitada:** Fazer a page.tsx buscar todos os dados no servidor e passar via props para os gráficos.

**Razão:** Recharts usa `window`, `ResizeObserver` e SVG APIs que não existem no Node.js. A tentativa de usar SSR com Recharts requer `dynamic(() => import(...), { ssr: false })` para cada componente. A abordagem escolhida (Client Components com fetch independente) é mais simples, permite loading states por gráfico, e mantém a page.tsx limpa com apenas dados críticos (KPIs, alertas, próximos agendamentos).

**Impacto em performance:** Cada gráfico faz 1 request adicional ao carregar a página. Com 4 gráficos, são 4 requests paralelos. Aceitável dado o contexto (dashboard interno, não público, base de dados pequena).

### Decisão 3 — Helpers puros extraídos para `src/lib/bi-helpers.ts`

**Decisão:** As funções `monthKey`, `lastNMonths`, `workingDaysInMonth`, `zeroMap` e `buildOccupancyResult` foram extraídas para um módulo independente e testável.

**Razão:** Segue o princípio de que lógica pura (sem I/O, sem efeitos laterais) deve ser testável sem mocks. Os 16 assertions de `bi-helpers.test.ts` validam o comportamento crítico dos helpers sem necessidade de base de dados ou browser.

### Decisão 4 — PDF gerado client-side com `@react-pdf/renderer`

**Decisão:** Usar `@react-pdf/renderer` (já instalado a v4.5.1) com import dinâmico no browser para gerar o PDF localmente e descarregar sem passar pelo servidor.

**Alternativas rejeitadas:**
- **Puppeteer server-side**: Requer browser headless, pesado, incompatível com Vercel serverless sem configuração adicional.
- **PDFKit no servidor**: Sem suporte a JSX; markup mais verbose; não reutiliza os tipos TypeScript existentes.
- **jsPDF**: API de baixo nível; não suporta layout de documentos estruturados de forma declarativa.

**Razão da escolha:** `@react-pdf/renderer` permite declarar o documento em JSX (familiar), suporta layout em `flexbox`, e funciona inteiramente no browser sem overhead de servidor. O `dynamic import` garante que o bundle só é carregado quando o utilizador clica "Exportar PDF".

**Risco mitigado:** A API `pdf(doc).toBlob()` é assíncrona e foi testada offline com v4.5.1. O componente `MonthlyReportPdf` gere loading state e erros.

### Decisão 5 — `workingDaysInMonth` usa ratio 5/7 (sem calendário angolano)

**Decisão:** Calcular dias úteis como `Math.round(diasDoMês × 5/7)` sem considerar feriados nacionais ou angolanos.

**Razão:** Feriados variam por ano e requerem uma lista de datas a manter. Para a taxa de ocupação (métrica indicativa, não contratual), a aproximação por ratio é suficiente e consistente. A taxa de ocupação é um KPI de tendência, não um cálculo de facturação.

**Revisão futura:** Se o Azul Coworking necessitar de métricas exactas de disponibilidade (para SLAs), criar um `CalendarConfig` em base de dados com dias não operacionais.

---

## Consequências

**Positivas:**
- Dashboard completamente funcional sem alterações ao schema Prisma (sem nova migração)
- Gráficos interactivos com Recharts (já instalado, sem nova dependência)
- Relatório PDF profissional sem servidor headless
- Helpers BI testáveis com 16 assertions a passar
- Sidebar reorganizado com grupo "Segurança & Admin" visível

**Negativas / Riscos aceites:**
- 4 requests cliente ao carregar dashboard (paralelos, impacto mínimo)
- Dias úteis calculados por ratio (não exactos por feriados)
- PDF gerado no browser: se o utilizador tiver pouca memória RAM, pode ser lento para relatórios futuros com muitos dados

---

## Ficheiros Criados/Modificados

| Ficheiro | Operação |
|---|---|
| `src/lib/bi-helpers.ts` | NOVO — funções puras BI |
| `src/app/api/bi/kpis/route.ts` | NOVO |
| `src/app/api/bi/revenue/route.ts` | NOVO |
| `src/app/api/bi/occupancy/route.ts` | NOVO |
| `src/app/api/bi/leads/route.ts` | NOVO |
| `src/app/api/bi/payments-summary/route.ts` | NOVO |
| `src/app/api/bi/report/monthly/route.ts` | NOVO |
| `src/components/admin/KpiCard.tsx` | NOVO |
| `src/components/admin/MonthlyReportPdf.tsx` | NOVO |
| `src/components/admin/charts/RevenueChart.tsx` | NOVO |
| `src/components/admin/charts/OccupancyChart.tsx` | NOVO |
| `src/components/admin/charts/LeadFunnelChart.tsx` | NOVO |
| `src/components/admin/charts/PaymentStatusChart.tsx` | NOVO |
| `src/components/admin/charts/ChartSkeleton.tsx` | NOVO |
| `src/app/admin/dashboard/page.tsx` | SUBSTITUIÇÃO |
| `src/components/admin/Sidebar.tsx` | EDIÇÃO — grupo "Segurança & Admin" |
| `src/__tests__/unit/bi-helpers.test.ts` | NOVO — 16 assertions |
| `docs/09-dashboard/README.md` | CONCLUÍDO |

---

*ADR-036 — VD Platform — 29 Julho 2026*
