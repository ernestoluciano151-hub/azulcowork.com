# Volume 01 — CRM · Executive Summary

> **Para aprovação do Product Owner antes de qualquer implementação**  
> **Versão:** 1.0.0-draft · **Data:** 2026-07-28  
> **Apresentado por:** Claude (Arquiteto-Chefe VD Platform)  
> **Destinatário:** Ernesto Pinto Luciano (Product Owner)

---

## Decisão Necessária

> **Aprovo o Volume 01 — CRM e autorizo o início da implementação?**  
> ✅ Aprovado → implementação inicia pelo Sprint CRM-1  
> 🔁 Proposta de alterações → indicar o que deve ser revisto

---

## 1. O Que Está Documentado

Foram produzidos 9 documentos de especificação que cobrem integralmente o Volume 01:

| Documento | Conteúdo | Estado |
|---|---|---|
| `README.md` | Índice mestre, regras, ADRs, timeline | ✅ Redigido |
| `customer360.md` | Customer 360°, ciclos de vida, regras de negócio | ✅ Redigido |
| `data-model.md` | Schema Prisma completo, ERD, índices, enums | ✅ Redigido |
| `pipeline.md` | Funil comercial, KPIs, Follow-up Engine | ✅ Redigido |
| `events.md` | Catálogo de 39 eventos CRM + handlers | ✅ Redigido |
| `api.md` | 50+ endpoints, formatos de resposta, erros | ✅ Redigido |
| `permissions.md` | Matriz RBAC por role e operação | ✅ Redigido |
| `ux.md` | 8 fluxos UX, wireframes, rotas, atalhos | ✅ Redigido |
| `testing.md` | Estratégia de testes, fixtures, cobertura | ✅ Redigido |
| `migration.md` | Migração Lead→Company, rollback, validação | ✅ Redigido |

Decisões arquitecturais documentadas em ADR-016 a ADR-020 (`docs/adr/README.md`).

---

## 2. A Grande Decisão Arquitectural

**Lead deixa de ser uma entidade. Passa a ser um estado.**

Actualmente a plataforma tem uma tabela `leads` simples. No Volume 01, `Company` torna-se a entidade raiz de todo o CRM. Um "lead" é simplesmente uma Company com `pipelineStage: NEW_LEAD`.

**Porquê esta decisão:**
- Quando um lead se converte em cliente, não existe duplicação nem perda de historial — é a mesma entidade que muda de estado.
- O Customer 360° torna-se possível: toda a actividade (reuniões, propostas, facturas, contratos de coworking) fica associada à mesma Company.
- O re-engagement é trivial: basta mudar o stage de volta a `NEW_LEAD`.

**Impacto imediato:** a tabela `leads` existente precisa de ser migrada para o novo modelo antes de qualquer nova funcionalidade CRM entrar em produção. O plano de migração completo (incluindo rollback seguro) está documentado em `migration.md`.

---

## 3. Entidades do CRM (Schema Novo)

```
Company ──┬── Contact (contactos da empresa)
          ├── Deal (oportunidades comerciais)
          ├── Activity (chamadas, emails, reuniões)
          ├── Task (follow-ups, lembretes)
          ├── Note (notas internas)
          ├── Tag (categorização)
          └── TimelineEntry (historial cronológico, append-only)
```

Todas as entidades têm FK obrigatória para `Company`. Sem excepções.

---

## 4. Pipeline Comercial

8 estados com transições controladas por state machine:

```
NEW_LEAD → CONTACTED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → WON
                                                               ↘ LOST → NEW_LEAD (re-engagement)
```

**Regras de negócio críticas aprovadas:**
- Deal `LOST` sem `lostReason` → rejeitado (422)
- Máximo 1 deal em `NEGOTIATION` por empresa simultaneamente
- Desconto > 10% requer aprovação de ADMIN
- Follow-up automático criado 3 dias após `PROPOSAL_SENT`
- Task vencida há mais de 24h gera notificação via Event Bus

---

## 5. Customer 360° — O Que o Utilizador Vê

Ao abrir uma empresa, o utilizador vê numa única página:

- Dados gerais da empresa (NIF, sector, endereço, stage, valor total)
- Contactos (com link para email/telefone directo)
- Deal activo com valor e probabilidade
- Activities recentes (chamadas, emails, reuniões)
- Tasks pendentes com prazo
- **Timeline completa** — historial cronológico de tudo o que aconteceu com aquela empresa, incluindo eventos de outros módulos (facturas pagas, contratos de coworking renovados, reservas de sala)

---

## 6. Integração com Módulos Existentes

O CRM subscreve eventos publicados pelos outros módulos via Event Bus existente (sem acoplamento directo):

| Módulo | Eventos consumidos pelo CRM |
|---|---|
| Financeiro | `invoice.issued`, `invoice.paid`, `invoice.overdue`, `payment.received` |
| Coworking | `contract.created`, `contract.renewed`, `contract.cancelled`, `member.checked_in`, `member.checked_out` |
| Reservas | `booking.created`, `booking.confirmed`, `booking.cancelled`, `booking.completed` |

---

## 7. Permissões (sem alteração ao modelo P0)

| Operação | ADMIN | COMERCIAL | FINANCEIRO | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Ver tudo | ✅ | ✅ | ✅ | ✅ |
| Criar/editar | ✅ | ✅ | ❌ | ❌ |
| Eliminar | ✅ | ❌ | ❌ | ❌ |
| Merge empresas | ✅ | ❌ | ❌ | ❌ |
| Aprovar desconto | ✅ | ❌ | ❌ | ❌ |

Row-level filtering (COMERCIAL vê apenas as suas empresas) é diferido para L3 — ADR-020.

---

## 8. Garantias de Qualidade Herdadas da P0

O Volume 01 mantém todas as garantias alcançadas na Fase P0:

| Garantia | Nível P0 | Nível CRM (alvo) |
|---|---|---|
| Cobertura de testes | 91.8% | ≥ 60% (global) + ≥ 95% state machine |
| Zero erros TypeScript | ✅ | ✅ mantido |
| RBAC em todos os endpoints | ✅ | ✅ todos os endpoints CRM |
| Rate limiting | ✅ | ✅ endpoint `/api/crm/companies` (POST) |
| Audit log | ✅ | ✅ em todas as mutações CRM |
| Sentry | ✅ | ✅ (DSN configurado, EU region) |
| Transacções Prisma | ✅ | ✅ obrigatórias em toda operação multi-tabela |

---

## 9. Plano de Implementação Proposto

### Sprint CRM-1 (Semana 1–2 de Agosto 2026)
Fundações do CRM — Schema + Migração + Company CRUD básico

- Criar schema Prisma (10 novas tabelas)
- Executar migração `leads → companies` em staging
- API `POST /api/crm/companies` com validação e Rate Limiting
- API `GET /api/crm/companies` com paginação e filtros
- API `GET /api/crm/companies/:id` (Customer 360° básico)
- AuditLog em todas as mutações

### Sprint CRM-2 (Semana 3–4 de Agosto 2026)
Pipeline + Deals + State Machine

- Pipeline state machine com todas as validações (BR-PIPE-*)
- API Deals (CRUD + transições de estado)
- Follow-up Engine (auto-criação de tasks)
- Kanban view (frontend)

### Sprint CRM-3 (Semana 1–2 de Setembro 2026)
Contacts + Activities + Tasks + Timeline

- API Contacts, Activities, Tasks, Notes
- Timeline Handler (Event Bus → TimelineEntry)
- Customer 360° completo (frontend)
- Integração com eventos do Financeiro e Cowork

### Sprint CRM-4 (Semana 3–4 de Setembro 2026)
Polimento + Testes + Merge + Dashboard

- Duplicate detection + Merge flow
- Dashboard CRM com KPIs
- Testes: cobertura ≥ 60% global, ≥ 95% state machine
- Validação em staging com dados reais
- Deploy para produção

---

## 10. Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Migração com dados inconsistentes | Média | Alto | Script idempotente + validação pós-migração + rollback seguro |
| Performance da Timeline em empresas antigas | Baixa | Médio | Índice `(companyId, occurredAt DESC)` + paginação obrigatória |
| Duplicação de empresas durante migração | Baixa | Médio | Detecção por NIF antes de criar |
| Regressões nos módulos P0 | Baixa | Alto | Quality Gate (Gate 1 e 2) obrigatório em todos os PRs |

---

## 11. O Que Este Volume NÃO Inclui

Para evitar ambiguidades, o Volume 01 **não inclui**:

- Row-level filtering por COMERCIAL → L3
- Automação de emails/SMS → L3
- Scoring de leads com IA → L4
- Relatórios de previsão de receita → L4
- Portal self-service para clientes → volume futuro
- Integração com ferramentas externas (Mailchimp, WhatsApp, etc.) → volume futuro

---

## Decisão

> **Product Owner: aprova o início da implementação do Volume 01 — CRM?**

Se sim, o Sprint CRM-1 inicia com a tarefa:  
**RFT-100 — Schema Prisma CRM: criar 10 tabelas + índices + enums**

---

*VD Platform — CRM Executive Summary v1.0.0-draft — 28 Julho 2026*  
*© 2026 VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA. Confidencial.*
