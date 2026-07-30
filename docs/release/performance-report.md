# Performance Report — VD Platform v1.0 RC

> **Versão:** 1.0.0-rc  
> **Data:** 30 Julho 2026  
> **Sprint:** RC-1  
> **Tipo:** Análise de performance baseada em revisão de código e arquitectura  
> **Nota:** Lighthouse e métricas reais requerem deployment em produção

---

## Sumário

| Área | Avaliação | Risco |
|---|---|---|
| Arquitectura Next.js 15 | ✅ Adequada | Baixo |
| Índices Prisma / PostgreSQL | ✅ Implementados | Baixo |
| Queries N+1 | ⚠️ Risco residual | Médio |
| Caching | ⚠️ Sem caching explícito | Médio |
| Bundle size | ⚠️ Não medido | Médio |
| Core Web Vitals (Lighthouse) | ❌ Requer produção | — |
| Admin pages (client-side) | ⚠️ Loading state necessário | Médio |
| Cron performance | ✅ Adequada | Baixo |
| Conexões BD | ✅ PrismaClient singleton | Baixo |

---

## PERF-01 — Arquitectura e Stack

**Estado: ✅ Adequada**

**Stack avaliada:**
- Next.js 15 com App Router — SSR/SSG/ISR disponíveis
- PostgreSQL via Neon serverless — latência de cold start: ~50-200ms
- Cloudinary CDN — servindo PDFs e imagens em edge
- Vercel Edge Network — routing global

**Para o caso de uso Azul Coworking (< 50 utilizadores concurrent):** A stack é significativamente over-provisioned. Não há risco de performance para o volume actual.

---

## PERF-02 — Índices da Base de Dados

**Estado: ✅ Implementados**

Índices no `prisma/schema.prisma` verificados:

**Modelo Lead:**
```
@@index([status])          — filtros de pipeline
@@index([scheduledDate])   — calendário e ordenação
@@index([createdAt])       — listagem por recência
@@index([leadCompanyId])   — join com Company
```

**Modelo Reservation (verificado nos volumes anteriores):**
```
@@index([status])
@@index([roomId, startTime, endTime])   — conflict check crítico
@@index([companyId])
```

**AuditLog:**
```
@@index([entity, entityId])  — lookup por entidade
@@index([actorId])            — histórico por utilizador
@@index([createdAt])          — paginação temporal
```

**Avaliação:** Os índices cobrem os padrões de query mais frequentes. As queries de conflict check de reservas usam `$transaction` com isolation `Serializable` — correctamente indexadas.

---

## PERF-03 — Risco de Queries N+1

**Estado: ⚠️ Risco Residual**

**Análise:**

O Prisma com `include` resolve joins em queries únicas. Os padrões analisados:

**Customer 360° (`/api/crm/companies/[id]`):** Usa `include: { contacts, deals, activities, timeline }` — 1 query com múltiplos joins. ✅

**Dashboard ERP:** Usa múltiplas queries paralelas (`Promise.all`) — eficiente. ✅

**Achado PERF-03-A (Médio):** Algumas listagens (ex: `/api/erp/invoices`) podem fazer query de `company` por linha em loops se não usarem `include`. Requer verificação nos serviços ERP.

**Achado PERF-03-B (Baixo):** A página `/admin/erp/fluxo-caixa` faz 3 fetches paralelos em `Promise.all` no `useEffect` — correcto para client-side.

---

## PERF-04 — Caching

**Estado: ⚠️ Sem caching explícito**

**Análise:**

O VD Platform v1.0 não implementa caching explícito (Redis, Next.js cache tags, etc.). Todos os dados são servidos directamente da BD em cada request.

**Impacto para Azul Coworking:** Com < 50 utilizadores, a ausência de caching não é um problema. A latência esperada por request de API: 50-150ms (Neon serverless + Prisma).

**Recomendação para v1.1:**
- Dashboard BI: cache de 5 minutos (dados agregados)
- Listagens de salas/planos: cache de 1 minuto (dados estáticos)
- Usar `unstable_cache` do Next.js ou Redis no Volume 13+

---

## PERF-05 — Bundle Size (Estimado)

**Estado: ⚠️ Não medido**

**Dependências com maior impacto esperado:**

| Pacote | Impacto estimado | Observação |
|---|---|---|
| `recharts` | ~150KB gzipped | Gráficos do dashboard BI |
| `@react-pdf/renderer` | ~200KB gzipped | Geração de PDFs no cliente |
| `react-day-picker` | ~30KB gzipped | Calendário |
| `next` (framework) | Base ~100KB | Não evitável |

**Achado PERF-05-A (Médio):** `@react-pdf/renderer` é uma dependência pesada. Se for usado apenas server-side (geração de PDFs em API routes), deve ser importado dinamicamente: `const PDFRenderer = await import('@react-pdf/renderer')`. Verificar nos serviços de PDF.

**Acção obrigatória pós-deploy:**
```bash
# No painel Vercel após primeiro deploy:
# Analytics → Web Vitals → First Contentful Paint, LCP, TBT
# OU:
npx @next/bundle-analyzer
```

---

## PERF-06 — Core Web Vitals (Lighthouse)

**Estado: ❌ Requer ambiente de produção**

Não é possível executar Lighthouse sem URL de produção. Targets esperados para v1.0:

| Métrica | Target | Contexto |
|---|---|---|
| FCP (First Contentful Paint) | < 2.5s | Páginas admin com loading state |
| LCP (Largest Contentful Paint) | < 3.0s | Dashboard com gráficos Recharts |
| TBT (Total Blocking Time) | < 300ms | Recharts + React hydration |
| CLS (Cumulative Layout Shift) | < 0.1 | Skeleton loaders implementados |
| TTI (Time to Interactive) | < 4.0s | Client Components com fetch |

**Acção:** Executar Lighthouse no primeiro dia de produção e registar baseline.

---

## PERF-07 — Admin Pages (Client-Side Rendering)

**Estado: ⚠️ Loading state necessário**

As 34 páginas admin usam `"use client"` com `fetch()` no `useEffect`. Padrão implementado:

```
Página carrega → skeleton/loading state → fetch API → renderiza dados
```

**Achado PERF-07-A (Baixo):** As páginas ERP criadas no VOL12 todas implementam `loading state` com texto "A carregar..." — correcto. No entanto, não usam Suspense boundaries nem skeleton UI. Para a escala actual, é aceitável.

**Achado PERF-07-B (Baixo):** As páginas admin não têm paginação server-side nas queries mais pesadas. Para listagens > 100 registos, pode haver degradação. As APIs suportam `page` e `limit` — a paginação client-side está implementada.

---

## PERF-08 — Cron Jobs

**Estado: ✅ Adequada**

**Análise dos 11 crons:**

| Cron | Frequência | Tempo estimado | Risco |
|---|---|---|---|
| erp-daily | Diário 06:00 UTC | 1-5s | Baixo |
| erp-invoice-generate | Mensal dia 1 | 10-30s (batch) | Baixo |
| erp-monthly-snapshot | Mensal dias 28-31 | 5-15s | Baixo |
| portal-sla-check | A cada 2h | 1-3s | Baixo |
| portal-notifications-retry | A cada 5min | 1-2s | Baixo |
| reservations-close | Diário 02:00 UTC | 1-3s | Baixo |
| portal-rent-due | Diário 07:00 UTC | 1-3s | Baixo |
| portal-contract-expiring | Diário 07:00 UTC | 1-3s | Baixo |
| portal-payment-overdue | Diário 08:00 UTC | 1-3s | Baixo |
| portal-auto-close-tickets | Diário 08:00 UTC | 1-3s | Baixo |
| communication-daily | Diário 07:00 UTC | 2-5s | Baixo |

**Achado PERF-08-A (Baixo):** `portal-notifications-retry` executa a cada 5 minutos (12x/hora). Em Neon serverless, isto pode causar cold starts frequentes. Para o volume actual (< 50 subscriptions push), é negligível.

---

## PERF-09 — Conexões de Base de Dados

**Estado: ✅ Adequada**

- `PrismaClient` é um singleton (`src/lib/prisma.ts`) — zero connection pools desnecessários
- Neon serverless: connection pooling via PgBouncer automático
- Limite de conexões Neon (plano free): 20 conexões simultâneas — adequado para < 50 utilizadores

**Achado PERF-09-A (Baixo):** `portal-notifications-retry` a cada 5min pode manter conexões activas. Monitorar dashboard Neon nas primeiras 48h.

---

## Targets de Performance para Piloto RC-1

| KPI | Target | Como medir |
|---|---|---|
| Uptime | ≥ 99.5% (30 dias) | Vercel Analytics |
| Latência API p95 | < 500ms | Sentry Performance |
| Erro rate | < 0.5% | Sentry |
| FCP (admin pages) | < 3s | Lighthouse pós-deploy |
| BD query p95 | < 100ms | Neon dashboard |
| Cron success rate | 100% | Vercel Logs |

---

## Acções Obrigatórias Pré-Piloto

1. Executar `npm audit` — sem HIGH/CRITICAL
2. Executar Lighthouse nas 3 páginas mais críticas: dashboard admin, kanban CRM, fluxo de caixa
3. Verificar bundle size com `@next/bundle-analyzer`
4. Monitorar conexões Neon nas primeiras 24h
5. Verificar que `@react-pdf/renderer` é importado dinamicamente nos API routes

---

*VD Platform — Performance Report v1.0 RC — 30 Jul 2026*
