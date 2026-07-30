# Painel de Métricas de Saúde — VD Platform

> **Documento:** AUDIT-004 (Painel Permanente)  
> **Actualização:** Quinzenal (1.º e 15.º de cada mês)  
> **Responsável pela Actualização:** Arquiteto-Chefe  
> **Aprovação de Metas:** Product Owner  

---

## Como Usar Este Painel

Este painel é o **único documento de verdade sobre a saúde técnica da plataforma**. É actualizado após cada sprint concluído e após cada re-auditoria. Os scores são calculados com base em critérios objectivos definidos na secção 9.

**Para o Product Owner:** Use este painel para tomar decisões informadas sobre quando avançar para a próxima fase, quando investir em qualidade vs. features, e para monitorizar o progresso dos investimentos em engenharia.

**Para o Arquiteto-Chefe:** Actualize após cada sprint. Mantenha o histórico. Seja honesto — um score inflacionado é mais perigoso do que um score baixo real.

---

## Painel Principal

```
╔══════════════════════════════════════════════════════════════════════════════╗
║             VD PLATFORM — HEALTH METRICS DASHBOARD                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ÚLTIMA ACTUALIZAÇÃO: Julho 2026 (baseline pós-auditoria)                  ║
║  PRÓXIMA ACTUALIZAÇÃO: Agosto 2026 (após Sprint P0-A)                      ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  SCORE GLOBAL                                                                ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                   ║
║  ACTUAL  ████████████░░░░░░░░░░░░░░░░░░░░  58 / 100  ⚠️  MODERADO         ║
║  TARGET  ████████████████████████████░░░░  85 / 100  ✅ (Fase 1 saída)    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 1. Scores por Categoria

| Categoria | Actual | Target P0 | Target Fase 1 | Máximo | Tendência |
|---|---|---|---|---|---|
| 🛡️ Segurança | **42** | 80 | 90 | 100 | ↗️ (7 items P0 pendentes) |
| ✅ Funcionalidade | **88** | 90 | 95 | 100 | → (estável) |
| 🧪 Testes | **0** | 40 | 70 | 100 | ↗️ (Vitest a instalar) |
| 🏗️ Arquitectura | **61** | 75 | 85 | 100 | ↗️ (DRY, SSoT a corrigir) |
| 📐 Qualidade Código | **58** | 72 | 85 | 100 | ↗️ (any, cast, dead code) |
| ⚡ Performance | **68** | 75 | 85 | 100 | ↗️ (queries em memória) |
| 🔍 Observabilidade | **15** | 65 | 85 | 100 | ↗️ (Sentry pendente) |
| **GLOBAL** | **58** | **72** | **85** | **100** | ↗️ |

---

## 2. Score de Segurança — Detalhe

| Indicador | Peso | Actual | Target P0 | Estado |
|---|---|---|---|---|
| JWT Secret obrigatório (sem fallback) | 20% | ❌ 0 | ✅ 20 | Pendente RFT-001 |
| RBAC em 100% das API Routes | 20% | ❌ 2 | ✅ 20 | Pendente RFT-004 |
| TOTP 2FA integrado no login | 15% | ❌ 0 | ✅ 15 | Pendente RFT-015 |
| Rate limiting (login + público) | 15% | ⚠️ 10 | ✅ 15 | Parcialmente implementado |
| Headers HTTP de segurança | 10% | ✅ 10 | ✅ 10 | OK |
| Input validation (sanitização) | 10% | ⚠️ 7 | ✅ 10 | Sem Zod ainda |
| Sem dados sensíveis hardcoded | 10% | ⚠️ 5 | ✅ 10 | Email com placeholder errado |
| CSRF Protection | 5% | ❌ 0 | ⚠️ 3 | Fase 1 |
| Sem exposição de stack trace | 5% | ⚠️ 3 | ✅ 5 | Parcial |
| **TOTAL** | 100% | **37/100 → 42** | **108 → cap 80** | |

---

## 3. Score de Testes — Detalhe

| Módulo | Cobertura Actual | Target P0 | Target Fase 1 | Ficheiro de Testes |
|---|---|---|---|---|
| `pricing-service.ts` | 0% | 95% | 100% | `__tests__/pricing-service.test.ts` |
| `finance-service.ts` | 0% | 70% | 80% | `__tests__/finance-service.test.ts` |
| `finance.ts` | 0% | 70% | 80% | `__tests__/finance.test.ts` |
| `document-numbering.ts` | — (não existe ainda) | 90% | 95% | `__tests__/document-numbering.test.ts` |
| `validators.ts` | 0% | 100% | 100% | `__tests__/validators.test.ts` |
| `rateLimit.ts` | 0% | 80% | 85% | `__tests__/rateLimit.test.ts` |
| `auth.ts` | 0% | 70% | 75% | `__tests__/auth.test.ts` |
| `timeline.ts` | 0% | 50% | 65% | Fase 1 |
| `event-handlers.ts` | 0% | 40% | 65% | Fase 1 |
| **Global** | **0%** | **≥ 60%** | **≥ 70%** | |

---

## 4. Score de Arquitectura — Detalhe

| Princípio | Actual | Target P0 | Estado |
|---|---|---|---|
| Clean Architecture (camadas corretas) | 65% | 80% | Lógica financeira em route |
| SSoT (sem duplicação de dados/lógica) | 50% | 80% | Lógica financeira duplicada |
| DRY (sem duplicação de código) | 55% | 80% | FinanceService duplicado em route |
| Event Bus (comunicação assíncrona) | 80% | 85% | Funcional mas em memória |
| Repository Pattern | 0% | 0% | Fase 2 |
| Domain Events (publicar após tx) | 90% | 95% | Quase correcto |
| Bounded Contexts (separação de domínios) | 70% | 80% | Cowork/Sala misturados no Finance |
| **MÉDIA** | **59%** | **74%** | |

---

## 5. Inventário de Findings

### 5.1 Findings Críticos (P0)

| ID | Finding | Estado | Resolvido em |
|---|---|---|---|
| SEC-001 | JWT fallback secret | ❌ Aberto | Sprint P0-A → RFT-001 |
| SEC-002 | RBAC incompleto nas API Routes | ❌ Aberto | Sprint P0-A → RFT-004 |
| DATA-001 | TOCTOU no conflict check de reservas | ❌ Aberto | Sprint P0-B → RFT-006 |
| DATA-002 | Race condition na numeração de documentos | ❌ Aberto | Sprint P0-B → RFT-007 |
| ARCH-001 | Lógica financeira duplicada | ❌ Aberto | Sprint P0-C → RFT-010 |
| SEC-003 | TOTP 2FA sem integração no login | ❌ Aberto | Sprint P0-D → RFT-015 |
| DATA-003 | recordFinancialHistory fora de contexto tx | ❌ Aberto | Sprint P0-B → RFT-008 |

### 5.2 Findings Altos (P1)

| ID | Finding | Estado | Resolvido em |
|---|---|---|---|
| SEC-004 | (admin as any).role no login | ❌ Aberto | Sprint P0-A → RFT-002 |
| SEC-005 | Sem CSRF protection | ❌ Aberto | Fase 1 |
| DATA-004 | Mistura contextos financeiros | ❌ Aberto | Sprint P0-B → RFT-009 |
| ARCH-002 | AdminUser.role enum inconsistente | ❌ Aberto | Sprint P0-A → RFT-003 |
| PERF-001 | Queries sem paginação em KPIs | ❌ Aberto | Sprint P0-D → parcial |
| QUAL-001 | TypeScript ignoreBuildErrors | ❌ Aberto | Sprint P0-D → RFT-019 |
| SEC-006 | Contactos hardcoded errados nos emails | ❌ Aberto | Sprint P0-A → RFT-005 |
| DT-016 | TOTP 2FA sem integração | ❌ Aberto | Sprint P0-D → RFT-015 |
| DT-019 | Mistura contextos financeiros | ❌ Aberto | Sprint P0-B → RFT-009 |

---

## 6. Dívida Técnica — Tracking

| ID | Dívida | Impacto | Fase | Estado |
|---|---|---|---|---|
| DT-001 | TypeScript ignoreBuildErrors | Alto | P0-D | ❌ |
| DT-002 | Sem testes unitários | Crítico | P0-C | ❌ |
| DT-003 | Conflict check TOCTOU | Crítico | P0-B | ❌ |
| DT-004 | Event Bus sem persistência | Médio | Fase 2 | 📋 |
| DT-005 | Dois geradores de PDF | Baixo | Fase 1 | 📋 |
| DT-006 | SQLite dev ≠ PostgreSQL prod | Médio | P0 | ❌ |
| DT-007 | Sem paginação em alguns endpoints | Médio | Fase 1 | ⚠️ Parcial |
| DT-008 | Sem Zod para validação | Médio | Fase 1 | 📋 |
| DT-009 | Sem error monitoring | Alto | P0-D | ❌ |
| DT-010 | Rate limiting incompleto | Alto | P0-D | ⚠️ Parcial |
| DT-011 | JWT fallback secret | Crítico | P0-A | ❌ |
| DT-012 | RBAC incompleto | Crítico | P0-A | ❌ |
| DT-013 | TOCTOU conflict check | Crítico | P0-B | ❌ |
| DT-014 | Numeração race condition | Crítico | P0-B | ❌ |
| DT-015 | Lógica financeira duplicada | Alto | P0-C | ❌ |
| DT-016 | TOTP sem integração | Crítico | P0-D | ❌ |
| DT-017 | recordFinancialHistory fora de tx | Crítico | P0-B | ❌ |
| DT-018 | AdminRole enum inconsistente | Alto | P0-A | ❌ |
| DT-019 | Mistura contextos financeiros | Alto | P0-B | ❌ |
| DT-020 | Contactos hardcoded errados | Alto | P0-A | ❌ |

**Legenda:** ❌ Pendente · ⚠️ Parcial · ✅ Resolvido · 📋 Planeado para fase futura

---

## 7. Saúde por Módulo

| Módulo | Funcionalidade | Segurança | Qualidade | Testes | Score |
|---|---|---|---|---|---|
| CRM (Leads, Empresas) | 85% | 50% | 60% | 0% | 49% |
| Cowork (Contratos, Colaboradores) | 80% | 45% | 65% | 0% | 48% |
| Reservas (Sala) | 78% | 50% | 55% | 0% | 45% |
| Financeiro | 82% | 40% | 72% | 0% | 50% |
| Segurança/Auth | 55% | — | 60% | 0% | 55% |
| Infraestrutura | 70% | 75% | 65% | 0% | 70% |

---

## 8. Histórico de Scores

| Data | Score Global | Segurança | Testes | Arquitectura | Evento |
|---|---|---|---|---|---|
| Jul 2026 | 58 | 42 | 0 | 61 | Baseline — Auditoria Fase 0.5 |
| _Ago 2026_ | _previsto: 68_ | _previsto: 75_ | _previsto: 30_ | _previsto: 70_ | _Sprint P0-A + P0-B_ |
| _Set 2026_ | _previsto: 75_ | _previsto: 85_ | _previsto: 60_ | _previsto: 78_ | _Sprint P0-C + P0-D_ |
| _Dez 2026_ | _previsto: 85_ | _previsto: 90_ | _previsto: 70_ | _previsto: 85_ | _Fase 1 completa_ |

---

## 9. Critérios de Cálculo dos Scores

### 9.1 Score de Segurança (0-100)

```
Componentes:
  A. JWT/Auth sem vulnerabilidades críticas  → 0-25 pts
     (fallback secret = -25; cast any.role = -5; sem TOTP = -10)
  B. RBAC completo em todas as routes        → 0-25 pts
     (% de routes com role check × 25)
  C. Input validation + sanitização          → 0-20 pts
  D. Headers HTTP + cookies httpOnly         → 0-15 pts
  E. Rate limiting efectivo (multi-instância)→ 0-15 pts
```

### 9.2 Score de Testes (0-100)

```
Componentes:
  A. Cobertura global de linhas              → 0-40 pts
     (cobertura% × 0.4 × 100)
  B. Módulos críticos cobertos               → 0-30 pts
     (PricingService + FinanceService + finance)
  C. Testes de casos de erro                 → 0-20 pts
  D. Suite corre em < 30 segundos            → 0-10 pts
```

### 9.3 Score de Arquitectura (0-100)

```
Componentes:
  A. SSoT preservado (sem duplicação)        → 0-25 pts
  B. Clean Architecture respeitada           → 0-25 pts
  C. Event Bus usado correctamente           → 0-20 pts
  D. prisma.$transaction() em todas as ops   → 0-20 pts
  E. Bounded Contexts bem definidos          → 0-10 pts
```

### 9.4 Score de Qualidade de Código (0-100)

```
Componentes:
  A. Zero any TypeScript não justificado     → 0-25 pts
  B. Build sem erros (TypeScript + ESLint)   → 0-25 pts
  C. Sem double casts                        → 0-15 pts
  D. Sem dead code identificado              → 0-10 pts
  E. Funções < 50 linhas (> 90% das funções) → 0-15 pts
  F. Ficheiros < 300 linhas (> 90%)          → 0-10 pts
```

### 9.5 Score de Observabilidade (0-100)

```
Componentes:
  A. Error monitoring activo (Sentry)        → 0-40 pts
  B. Logs estruturados em operações críticas → 0-25 pts
  C. Alertas configurados (5xx, latência)    → 0-20 pts
  D. Métricas de performance monitorizadas   → 0-15 pts
```

---

## 10. Processo de Actualização

### Quando Actualizar

- Após cada sprint concluído (semanas 1-4 da Fase P0)
- Após qualquer re-auditoria
- Quando um finding é resolvido
- Quando uma nova dívida técnica é identificada
- **Nunca** inflacionar scores sem evidência objectiva

### Como Actualizar

1. Executar `npm run test:coverage` — copiar resultado para secção 3
2. Verificar manualmente cada finding — actualizar estados na secção 5
3. Recalcular scores por categoria usando critérios da secção 9
4. Actualizar secção 8 (histórico) com nova linha
5. Commitar: `docs(metrics): actualização pós-sprint P0-A [Score: 68/100]`

### Formato do Commit

```
docs(metrics): actualização quinzenal [Score: NN/100]

Alterações:
- Segurança: NN → NN (RFT-001 e RFT-004 resolvidos)
- Testes: 0% → NN% (PricingService e finance.ts cobertos)
- X findings P0 resolvidos, Y findings P1 em progresso
```

---

## 11. Metas Oficiais por Marco

| Marco | Score Target | Segurança | Testes | Arquitectura | Critério de Passagem |
|---|---|---|---|---|---|
| **Fim Fase P0** (Set 2026) | **≥ 72** | **≥ 80** | **≥ 40** | **≥ 75** | 0 findings P0 abertos |
| **Fim Vol 01 CRM** (Out 2026) | **≥ 76** | **≥ 85** | **≥ 55** | **≥ 78** | CRM Quality Gate aprovado |
| **Fim Fase 1** (Dez 2026) | **≥ 85** | **≥ 90** | **≥ 70** | **≥ 85** | 0 findings P0 ou P1 abertos |
| **Pré-Multi-tenant** (Jan 2027) | **≥ 88** | **≥ 92** | **≥ 75** | **≥ 88** | Audit multi-tenant aprovada |

---

*VD Platform — Metrics Dashboard v1.0 — Julho 2026*  
*Este documento é um registo vivo. A sua utilidade depende da honestidade das actualizações.*
