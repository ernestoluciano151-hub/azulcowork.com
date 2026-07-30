# Métricas do Sistema — VD Platform v1.0.0

> **Data de referência:** 29 Julho 2026  
> **Ambiente:** Produção (Vercel + Neon PostgreSQL)  
> **Este documento deve ser actualizado quinzenalmente** (mesmo ciclo que metrics-dashboard.md)

---

## 1. Score de Qualidade

| Dimensão | Score Actual | Score Alvo (Dez 2026) | Tendência |
|---|---|---|---|
| **Segurança** | 85/100 | 95/100 | ↑ |
| **Cobertura de Testes** | 62/100 | 80/100 | ↑ |
| **Dívida Técnica** | 70/100 | 90/100 | ↑ |
| **Documentação** | 90/100 | 95/100 | → |
| **Performance** | 55/100 | 80/100 | → |
| **TOTAL** | **72/100** | **88/100** | ↑ |

*Score anterior (Julho 2026 pré-ERP): 58/100*  
*Melhoria desde início da estabilização: +14 pontos*

---

## 2. Métricas de Código

| Métrica | Valor | Alvo |
|---|---|---|
| Serviços de domínio (`src/lib/`) | 23 ficheiros | — |
| API Route handlers | 123 endpoints | — |
| Ficheiros de teste | 19 | ≥ 30 (v1.1) |
| Testes unitários | ~475 | ≥ 600 (v1.1) |
| Modelos Prisma | 30 | — |
| Migrações aplicadas | 3 | — |
| TypeScript erros | 0 | 0 |
| Cobertura estimada (críticos) | 65% | ≥ 80% (v1.1) |
| Dependências com vuln. crítica | 0 | 0 |

---

## 3. Métricas de Arquitectura

| Componente | Estado | Observações |
|---|---|---|
| JWT sem fallback secret | ✅ | DT-011 resolvido |
| RBAC completo | ✅ | Todas as routes cobertas |
| Rate limiting | ✅ | Todas as routes de mutação |
| TypeScript strict | ✅ | ignoreBuildErrors removido |
| Ledger imutável | ✅ | ADR-021 activo |
| Transacções obrigatórias | ✅ | Todas as ops multi-tabela |
| TOTP 2FA | ✅ | Disponível (activação opt-in) |
| Sentry | ⚠️ | Config pronta; DSN pendente |
| Event Bus | ✅ | Todos os eventos publicados |
| Graceful degradation | ✅ | Cloudinary + SMTP |

---

## 4. Métricas de Negócio (Baseline — Go-Live)

*A preencher após activação em produção com dados reais.*

| KPI | Valor Actual | Data |
|---|---|---|
| Empresas activas no CRM | — | A preencher |
| Contratos ERP activos | — | A preencher |
| MRR (Monthly Recurring Revenue) | — Kz | A preencher |
| ARR (Annual Recurring Revenue) | — Kz | A preencher |
| Faturas emitidas (total) | — | A preencher |
| Pagamentos confirmados (total) | — | A preencher |
| Taxa de inadimplência | —% | A preencher |
| Leads no pipeline CRM | — | A preencher |
| Utilizadores admin activos | — | A preencher |

---

## 5. Métricas de Performance

*A recolher após 1 semana de operação em produção.*

| Métrica | Valor Actual | Alvo |
|---|---|---|
| Tempo de resposta P50 (API) | — ms | ≤ 300 ms |
| Tempo de resposta P95 (API) | — ms | ≤ 1.000 ms |
| Tempo de resposta P99 (API) | — ms | ≤ 3.000 ms |
| Cold start (Vercel Serverless) | — ms | ≤ 2.000 ms |
| Taxa de erros 5xx (24h) | —% | ≤ 0.1% |
| Uptime (30 dias) | —% | ≥ 99.5% |
| Geração PDF (fatura) | — ms | ≤ 5.000 ms |
| Export XLSX (P&L) | — ms | ≤ 10.000 ms |

---

## 6. Dívidas Técnicas — Estado Actual

| ID | Dívida | Prioridade | Estado |
|---|---|---|---|
| DT-001 | TypeScript ignoreBuildErrors | Alto | ✅ Resolvido v1.0 |
| DT-002 | Cobertura de testes abaixo de 80% | Médio | 🔄 Em melhoria |
| DT-009 | Sentry sem DSN em produção | Alto | ⚠️ Pendente activação |
| DT-010 | Rate limiting incompleto | Alto | ✅ Resolvido v1.0 |
| DT-011 | JWT fallback secret | Crítico | ✅ Resolvido v1.0 |
| DT-012 | RBAC incompleto | Crítico | ✅ Resolvido v1.0 |
| DT-013 | TOCTOU reservas | Crítico | ✅ Resolvido v1.0 |
| DT-014 | Numeração race condition | Crítico | ✅ Resolvido v1.0 |
| DT-016 | TOTP 2FA sem integração | Crítico | ✅ Resolvido v1.0 |
| DT-017 | recordFinancialHistory fora de tx | Crítico | ✅ Resolvido v1.0 |

**Score de dívida técnica:** 8 de 10 dívidas críticas/altas resolvidas (80%)

---

## 7. Volumes Implementados

| Volume | Módulo | Estado | Sprint de Conclusão |
|---|---|---|---|
| 00 | Foundation + Estabilização P0 | ✅ Concluído | Fev–Abr 2026 |
| 01 | CRM (Customer Relationship Management) | ✅ Concluído | CRM-FE-7 — Jun 2026 |
| 02 | ERP Financeiro Integrado | ✅ Concluído | ERP-9 — Jul 2026 |
| 03 | Portal do Cliente + Omnicanal | 📋 Proposto | Ago–Out 2026 |
| 04 | Reservas v2 (integração ERP) | 📋 Planeado | Nov 2026 |
| 05 | Portal do Cliente Avançado | 📋 Planeado | 2027 |

---

## 8. ADRs e Decisões Arquitecturais

| Categoria | Total de ADRs | Estado |
|---|---|---|
| Foundation (ADR-001 a ADR-005) | 5 | ✅ Aceite |
| Segurança P0 (ADR-006 a ADR-015) | 10 | ✅ Aceite |
| CRM (ADR-016 a ADR-020) | 5 | ✅ Aceite |
| ERP (ADR-021 a ADR-025) | 5 | ✅ Aceite |
| **Total** | **25** | **✅ Todos aceites** |

---

## 9. Histórico de Score

| Data | Score | Evento |
|---|---|---|
| Fev 2026 | 42/100 | Baseline inicial (auditoria) |
| Abr 2026 | 55/100 | Fase P0-A + P0-B concluída |
| Mai 2026 | 62/100 | Fase P0-C + P0-D concluída |
| Jun 2026 | 65/100 | Volume 01 (CRM) concluído |
| Jul 2026 | **72/100** | Volume 02 (ERP) concluído — v1.0.0 |
| Dez 2026 | 88/100 | Target após Volume 03 + P1 |

---

## 10. Próximas Acções (v1.1)

| Prioridade | Acção | Target |
|---|---|---|
| P0 | Activar Sentry com DSN real em produção | Set 2026 |
| P0 | Integration tests para ERP payment flow | Set 2026 |
| P1 | Cobertura de testes → 80% módulos críticos | Out 2026 |
| P1 | E2E tests com Playwright | Nov 2026 |
| P1 | Performance: optimizar queries com índices | Out 2026 |
| P2 | Bundle size optimization | Dez 2026 |

---

*VD Platform — System Metrics v1.0.0 — 29 Julho 2026*  
*Actualização quinzenal obrigatória: próxima em 12 Agosto 2026*
