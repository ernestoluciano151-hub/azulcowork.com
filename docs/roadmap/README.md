# Roadmap — VD Platform

> **Documento:** ROAD-001  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado v1.0  
> **Data:** Julho 2026  

---

## Visão de Roadmap

O VD Platform evolui em **fases**, cada uma com objectivos claros e critérios de conclusão. Nenhuma fase começa antes da anterior estar aprovada e estável.

```
2026                               2027                          2028+
  │                                  │                             │
  ├── Fase 0: Consolidação           ├── Fase 2: Multi-tenant      ├── Fase 4: Expansão
  │   Vol 00 Foundation (Jul 2026)   │   (Jan - Jun 2027)          │   PALOP + Global
  │                                  │                             │
  ├── Fase P0: Estabilização         ├── Fase 3: SaaS Mercado      │
  │   (Ago - Set 2026) ← ACTUAL      │   (Jul 2027 +)
  │
  ├── Fase 1: Produto Completo
      Vol 01-04 (Out - Dez 2026)
```

---

## Fase 0 — Foundation e Auditoria

**Período:** Julho 2026 (concluído)  
**Objectivo:** Documentar a arquitectura, estabelecer fundações, auditar o estado actual  
**Estado:** ✅ CONCLUÍDO

### Épicas

#### E00.1 — Documentação Foundation
| Feature | Prioridade | Estado |
|---|---|---|
| docs/README.md (índice mestre) | 🔴 CRÍTICA | ✅ Concluído |
| docs/00-foundation/* | 🔴 CRÍTICA | ✅ Concluído |
| docs/business-bible/* | 🔴 CRÍTICA | ✅ Concluído |
| docs/claude-guide/* | 🔴 CRÍTICA | ✅ Concluído |
| docs/adr/* (ADR-001 a ADR-005) | 🔴 CRÍTICA | ✅ Concluído |
| CLAUDE.md (raiz) | 🔴 CRÍTICA | 📋 Planeado |

#### E00.2 — Auditoria de Código
| Feature | Prioridade | Estado |
|---|---|---|
| Auditar módulo CRM | 🔴 CRÍTICA | 📋 Planeado |
| Auditar módulo Financeiro | 🔴 CRÍTICA | 📋 Planeado |
| Auditar módulo Reservas | 🔴 CRÍTICA | 📋 Planeado |
| Auditar segurança (RBAC) | 🔴 CRÍTICA | 📋 Planeado |

#### E00.3 — Dívidas Técnicas Críticas
| Dívida | Prioridade | Estado |
|---|---|---|
| BR-030: Verificação de conflito de reservas | 🔴 CRÍTICA | ❌ Pendente |
| BR-004: Prevenção de leads duplicados | 🟠 ALTA | ❌ Pendente |
| BR-011: Job de alertas de expiração de contratos | 🟠 ALTA | ❌ Pendente |
| BR-028: Penalidade por atraso implementada | 🟠 ALTA | ❌ Pendente |
| Instalar e configurar Vitest | 🔴 CRÍTICA | ❌ Pendente |
| Testes unitários FinanceService | 🔴 CRÍTICA | ❌ Pendente |
| Testes unitários PricingService | 🔴 CRÍTICA | ❌ Pendente |
| Remover TypeScript ignoreBuildErrors | 🟠 ALTA | 📋 Planeado Fase 1 |

---

## Fase P0 — Estabilização da Plataforma

**Período:** Agosto → Setembro 2026  
**Objectivo:** Resolver todos os itens P0 de segurança e integridade; estabelecer infraestrutura de qualidade  
**Estado:** ✅ APROVADO — Em execução  
**Documento:** `docs/p0-stabilization/README.md`

### Sprints

| Sprint | Foco | Período | Estado |
|---|---|---|---|
| P0-A | Segurança Imediata (JWT, RBAC, Roles, Emails) | Semana 1 Ago | 📋 Planeado |
| P0-B | Integridade de Dados (DocumentCounter, TOCTOU, Tx) | Semana 2 Ago | 📋 Planeado |
| P0-C | Infraestrutura de Testes (Vitest, cobertura, código) | Semana 3 Ago | 📋 Planeado |
| P0-D | Observabilidade + 2FA + TypeScript Strict | Semana 4 Ago | 📋 Planeado |
| QG Review | Quality Gate Review + aprovação para Vol 01 | Set 2026 | 📋 Planeado |

### Critérios de Saída

- Score global ≥ 72/100 (de 58/100)
- 0 findings de severidade CRÍTICA
- Cobertura de testes ≥ 60% nos módulos críticos
- npm run build sem erros
- Sentry activo em produção
- Quality Gate aprovado pelo Product Owner

---

## Fase 1 — Produto Completo para Azul Coworking

**Período:** Outubro → Dezembro 2026  
**Objectivo:** Tornar o VD Platform 100% operacional para as necessidades actuais do Azul Coworking

### Épicas

#### E01.1 — Portal do Cliente (v1)
| Feature | Prioridade |
|---|---|
| Login do cliente com código de acesso | 🔴 CRÍTICA |
| Vista de faturas e pagamentos | 🔴 CRÍTICA |
| Vista de contrato actual | 🟠 ALTA |
| Pedido de reserva de sala | 🟠 ALTA |
| Histórico de pagamentos | 🟠 ALTA |
| Download de recibos | 🟠 ALTA |

#### E01.2 — Gestão Documental
| Feature | Prioridade |
|---|---|
| Geração de propostas comerciais (.docx) | 🔴 CRÍTICA |
| Geração de contratos de alocação (.docx) | 🔴 CRÍTICA |
| Templates configuráveis de documentos | 🟠 ALTA |
| Repositório de documentos por empresa | 🟠 ALTA |
| Assinatura digital simples (futuro) | 🟢 BAIXA |

#### E01.3 — Automações Básicas
| Feature | Prioridade |
|---|---|
| Alerta automático 60/30/15/7 dias antes de expiração | 🔴 CRÍTICA |
| Reminder de pagamento D-5 antes do vencimento | 🟠 ALTA |
| Geração automática de faturas mensais | 🟠 ALTA |
| Email de boas-vindas ao novo cliente | 🟡 MÉDIA |
| Reminder de reserva D-1 | 🟡 MÉDIA |

#### E01.4 — Dashboard Executivo Completo
| Feature | Prioridade |
|---|---|
| KPIs em tempo real (receita, ocupação, leads) | 🟠 ALTA |
| Gráfico de receita mensal (últimos 12 meses) | 🟠 ALTA |
| Taxa de ocupação da sala por período | 🟠 ALTA |
| Taxa de conversão de leads | 🟡 MÉDIA |
| Relatório executivo diário (exportável) | 🟡 MÉDIA |
| Alertas de acção (contratos, pagamentos) | 🔴 CRÍTICA |

#### E01.5 — RBAC Completo
| Feature | Prioridade |
|---|---|
| Role FINANCEIRO implementado | 🔴 CRÍTICA |
| Role COMERCIAL com restrições correctas | 🔴 CRÍTICA |
| Role VIEWER implementado | 🟠 ALTA |
| Gestão de utilizadores pelo ADMIN | 🟠 ALTA |
| 2FA TOTP obrigatório para ADMIN | 🟠 ALTA |
| Log de sessões activas | 🟡 MÉDIA |

#### E01.6 — Qualidade e Testes
| Feature | Prioridade |
|---|---|
| Cobertura de testes > 60% para módulos críticos | 🔴 CRÍTICA |
| Remover TypeScript ignoreBuildErrors | 🟠 ALTA |
| Instalar Sentry para error monitoring | 🟠 ALTA |
| Performance: < 200ms para operações normais | 🟡 MÉDIA |

---

## Fase 2 — Multi-tenant SaaS v1

**Período:** Janeiro → Junho 2027  
**Objectivo:** Permitir que outros operadores de coworking usem a plataforma

### Épicas

#### E02.1 — Arquitectura Multi-tenant
| Feature | Prioridade |
|---|---|
| Schema multi-tenant (tenantId em todas as tabelas) | 🔴 CRÍTICA |
| Isolamento de dados por tenant | 🔴 CRÍTICA |
| Onboarding self-service de novos tenants | 🟠 ALTA |
| Configuração por tenant (logos, cores, domínio) | 🟠 ALTA |

#### E02.2 — Planos de Subscrição
| Feature | Prioridade |
|---|---|
| Plano Starter (funcionalidades básicas) | 🔴 CRÍTICA |
| Plano Professional (todas funcionalidades) | 🔴 CRÍTICA |
| Plano Enterprise (customizado) | 🟠 ALTA |
| Billing integrado (Stripe ou equivalente) | 🔴 CRÍTICA |

#### E02.3 — API Pública v1
| Feature | Prioridade |
|---|---|
| Autenticação OAuth2 para API | 🔴 CRÍTICA |
| Endpoints de leitura documentados | 🟠 ALTA |
| Webhooks para eventos principais | 🟠 ALTA |
| Rate limiting por API key | 🔴 CRÍTICA |
| Documentação OpenAPI (Swagger) | 🟠 ALTA |

#### E02.4 — Infra para Escala
| Feature | Prioridade |
|---|---|
| Redis Pub/Sub para Event Bus (multi-instância) | 🟠 ALTA |
| Cache Redis para queries frequentes | 🟡 MÉDIA |
| PostgreSQL read replica | 🟡 MÉDIA |
| CDN para assets estáticos | 🟠 ALTA |

---

## Fase 3 — SaaS de Mercado

**Período:** Julho 2027+  
**Objectivo:** Expansão para outros sectores e geografias

### Épicas Planeadas

#### E03.1 — Mobile App
- React Native (iOS + Android)
- Funcionalidades de campo: check-in, pagamentos, reservas

#### E03.2 — Business Intelligence Avançado
- Relatórios customizáveis drag-and-drop
- Projecções e forecasting com ML
- Benchmarking entre tenants (anónimo)

#### E03.3 — Integrações
- QuickBooks / Xero (contabilidade)
- Mailchimp / SendGrid (campanhas)
- Calendário Google / Microsoft 365
- Zapier / Make (automações no-code)

#### E03.4 — Expansão Geográfica
- Moçambique, Cabo Verde, São Tomé
- Multi-moeda nativa
- Conformidade fiscal local por país

---

## Critérios de Transição entre Fases

### Fase 0 → Fase 1
- [ ] Documentação Foundation 100% completa e aprovada
- [ ] Dívidas técnicas críticas resolvidas (BR-030, testes FinanceService)
- [ ] Auditoria de código concluída
- [ ] Nenhum bug crítico em produção

### Fase 1 → Fase 2
- [ ] Portal do Cliente em produção e usado por > 5 clientes
- [ ] Automações a funcionar sem falhas por 30 dias
- [ ] Cobertura de testes > 60%
- [ ] 0 vulnerabilidades de segurança críticas
- [ ] Feedback positivo do Product Owner sobre todas as features Fase 1

### Fase 2 → Fase 3
- [ ] Multi-tenant em produção com > 3 clientes externos
- [ ] API pública documentada e estável
- [ ] NPS > 7 dos clientes
- [ ] Receita recorrente mensal sustentável

---

## Dívidas Técnicas Conhecidas

| ID | Dívida | Impacto | Fase de Resolução |
|---|---|---|---|
| DT-001 | TypeScript ignoreBuildErrors | Alto | Fase 1 |
| DT-002 | Sem testes unitários | Crítico | Fase 0 |
| DT-003 | BR-030 não implementado (conflitos de reserva) | Crítico | Fase 0 |
| DT-004 | Event Bus sem persistência | Médio | Fase 2 |
| DT-005 | PDF com duas bibliotecas (padronizar) | Baixo | Fase 1 |
| DT-006 | SQLite em dev ≠ PostgreSQL em produção | Médio | Fase 0 |
| DT-007 | Sem paginação em alguns endpoints de listagem | Médio | Fase 1 |
| DT-008 | Sem Zod para validação de schema | Médio | Fase 1 |
| DT-009 | Sem error monitoring (Sentry) | Alto | Fase 1 |
| DT-010 | Rate limiting não cobre todos os endpoints públicos | Alto | Fase 0 |

---

*VD Platform — Roadmap v1.0.0 — Julho 2026*
