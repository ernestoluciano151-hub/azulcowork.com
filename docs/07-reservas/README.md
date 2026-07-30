# Volume 04 — Reservas: Sala de Reunião e Gestão de Agendamento

> **Volume:** 04  
> **Estado:** ✅ **CONCLUÍDO** — Sprint VOL04-7 (29 Jul 2026)  
> **Depende de:** Volume 01 (CRM ✅) · Volume 02 (ERP ✅) · Volume 03 (Portal ✅)  
> **Data de especificação:** 29 Julho 2026  
> **Product Owner:** Ernesto Pinto Luciano

---

## Contexto

O módulo de Reservas já existe no VD Platform com funcionalidade básica operacional.
Este volume não cria do zero — **audita, consolida, corrige e documenta** o que existe,
resolve dívidas técnicas críticas identificadas (DT-013, DT-017) e acrescenta as
funcionalidades em falta para tornar o módulo production-grade.

### Estado Actual (pré-VOL04)

| Componente | Estado | Observação |
|---|---|---|
| Schema Prisma (Reservation, MeetingPlan, RoomSettings, RoomPricing) | ✅ Existe | Sem alterações previstas |
| API CRUD `/api/reservations/*` | ✅ Existe | Conflict check PATCH sem tx serializable (DT-013) |
| API Planos `/api/plans/*` | ✅ Existe | Sem Zod; sem validação de preços negativos |
| API Configurações `/api/admin/room-settings` | ✅ Existe | PUT sem validação de horários |
| API Pricing `/api/admin/room-pricing/*` | ✅ Existe | Parallel com MeetingPlan — ambíguo |
| API Relatórios `/api/salas/reports` | ✅ Existe | Bom; falta exportação XLSX |
| Landing page pública `/salas` | ✅ Existe | Funcional |
| API Leads `/api/room-booking-leads/*` | ✅ Existe | Sem conversão de lead → reserva em tx |
| Admin pages `/admin/salas/*` | ✅ Existe | Funcional; sem state machine visual |
| Disponibilidade portal `/api/portal/rooms/availability` | ✅ Existe (VOL03) | Apenas portal |
| Machine de estados formal | ✅ Implementado (VOL04-1) | `src/lib/reservation-state-machine.ts` |
| Disponibilidade admin | ✅ Implementado (VOL04-2) | `GET /api/reservations/availability` · expõe eventName |
| Política de cancelamento | ✅ Implementado (VOL04-1) | `isCancellationFree()` · 24h · `CANCELLATION_FREE_HOURS` |
| Testes unitários | ✅ 3 ficheiros · ~35 casos (VOL04-1) | state-machine · conflict · cancellation |
| Testes de integração | ❌ Zero | Sem cobertura |
| Documentação formal | ❌ Zero | docs/modules/reservas/ e este volume |

---

## Visão

Transformar o módulo de Reservas num sistema **robusto, auditado e documentado**,
com state machine formal, política de cancelamento clara, e cobertura de testes
adequada para operar em produção com múltiplas reservas simultâneas.

---

## Princípios Obrigatórios

```
1. ATOMICIDADE          — conflict check + criação SEMPRE na mesma $transaction serializable
2. STATE MACHINE        — transições de estado explícitas e validadas; regressões proibidas
3. AUDITORIA FINANCEIRA — toda mutação financeira gera AuditLog + TimelineEntry
4. NUMERAÇÃO ATÓMICA    — RES, FT-SALA, REC, NL via DocumentCounter (sem race condition)
5. POLÍTICAS FORMAIS    — cancelamento, reembolso e no-show definidos e aplicados
6. SSoT PRICING         — MeetingPlan é a única fonte de preços; RoomPricing é legado
7. RBAC                 — ADMIN e COMERCIAL criam; FINANCEIRO confirma pagamentos
```

---

## Modelo de Estado da Reserva

```
                        ┌─────────────────────────────┐
                        │                             │
                [PENDENTE_APROVACAO]          [RESERVADO] ←── criação PAGAR_NO_DIA
                        │                             │
                        └────────┐   ┌───────────────┘
                                 ▼   ▼
                           [CONFIRMADA] ←── criação PAGAR_AGORA | FACTURAR | ISENTO
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
              [CONCLUIDA]               [CANCELADA]
              (evento passou)           (cancela antes)
```

**Transições válidas:**

| De → Para | Condição | Actor |
|---|---|---|
| PENDENTE_APROVACAO → CONFIRMADA | Admin aprova orçamento personalizado | ADMIN/COMERCIAL |
| PENDENTE_APROVACAO → CANCELADA | Admin rejeita | ADMIN |
| RESERVADO → CONFIRMADA | Pagamento recebido ou confirmação manual | ADMIN/FINANCEIRO |
| RESERVADO → CANCELADA | Cancelamento antes da data | ADMIN/COMERCIAL |
| CONFIRMADA → CONCLUIDA | Job cron após endDatetime | Sistema |
| CONFIRMADA → CANCELADA | Dentro da política de cancelamento | ADMIN |
| CONCLUIDA → * | **Proibido** | — |
| CANCELADA → * | **Proibido** (sem reactivação) | — |

---

## Entidades Existentes (sem alterações de schema)

```
MeetingPlan     — Plano/sala com capacidade e preçário completo (SSoT de preços)
Reservation     — Reserva principal (estado, financeiro, cliente, horário)
RoomBookingLead — Lead da landing page pública (pipeline de vendas de salas)
RoomPricing     — Tabela de preços por tier (LEGADO — manter mas não usar em lógica nova)
RoomSettings    — Configurações globais (horários, IVA default, desconto máximo)
```

---

## Regras de Negócio Críticas

```
BR-RES-001 — Conflict check: existStart < newEnd && existEnd > newStart
             (intervalos adjacentes: existEnd === newStart → NÃO é conflito)

BR-RES-002 — TODA criação e modificação de horário usa $transaction serializable
             (previne TOCTOU; nunca usar conflict check fora de transacção)

BR-RES-003 — RESERVADO implica pagamento pendente no dia do evento
             (sem confirmação em D-0 → no-show tracking)

BR-RES-004 — PENDENTE_APROVACAO implica orçamento personalizado aguarda validação
             (requireRole(ADMIN) para confirmar; COMERCIAL pode criar mas não confirmar)

BR-RES-005 — Cancelamento até 24h antes → reembolso total (se pago)
             Cancelamento < 24h antes → sem reembolso (taxa de 100%)
             No-show → sem reembolso + registo de no-show na empresa

BR-RES-006 — MeetingPlan é a única fonte de preços; RoomPricing é ignorado em lógica nova

BR-RES-007 — Desconto máximo configurável via RoomSettings.maxDiscount (default 100%)
             ADMIN pode ultrapassar; COMERCIAL está limitado pelo maxDiscount

BR-RES-008 — Reserva de empresa cowork (companyId presente) cria TimelineEntry na empresa
             Reserva de cliente externo (sem companyId) não cria TimelineEntry

BR-RES-009 — Conclusão automática: cron diário marca CONFIRMADA → CONCLUIDA após endDatetime

BR-RES-010 — reservationNumber é imutável após criação (nunca alterar)
```

---

## Índice de Documentos

| Documento | Conteúdo | Estado |
|---|---|---|
| [README.md](./README.md) | Visão, estado, princípios, sprints | 📋 Este ficheiro |
| [data-model.md](./data-model.md) | Modelos existentes + campos relevantes + índices | 📋 Especificação |
| [business-rules.md](./business-rules.md) | Regras de negócio + state machine + política cancelamento | 📋 Especificação |
| [api.md](./api.md) | Inventário completo de APIs existentes + novas | 📋 Especificação |
| [pricing.md](./pricing.md) | Motor de preços: MeetingPlan vs RoomPricing + cálculos | 📋 Especificação |
| [ux-flows.md](./ux-flows.md) | Fluxos admin: criar reserva, confirmar, cancelar, relatório | 📋 Especificação |
| [testing.md](./testing.md) | Estratégia de testes + especificações dos testes VOL04 | 📋 Especificação |
| [migration.md](./migration.md) | O que muda + riscos + rollback | 📋 Especificação |

---

## Roadmap de Sprints

| Sprint | Objectivo | Duração | Estado |
|---|---|---|---|
| **VOL04-0** | Auditoria + Especificação completa | 1 semana | ✅ Concluído — 29 Jul 2026 |
| **VOL04-1** | Hardening crítico: TOCTOU fix + DT-017 + state machine + testes unitários | 1 semana | ✅ Concluído — 29 Jul 2026 |
| **VOL04-2** | Auto-conclusão (cron) + admin availability + testes unitários | 3 dias | ✅ Concluído — 29 Jul 2026 |
| **VOL04-3** | MeetingPlan CRUD hardening + RoomSettings validação + plan-validators.ts | 3 dias | ✅ Concluído — 29 Jul 2026 |
| **VOL04-4** | Testes unitários: pricing engine (calcPrice, matchTier, precedência, edge cases) | 3 dias | ✅ Concluído — 29 Jul 2026 |
| **VOL04-5** | Testes de integração: ciclo completo (conflict + state machine + payment options + cron + cancellation + pricing) | 1 semana | ✅ Concluído — 29 Jul 2026 |
| **VOL04-6** | Documentação + ADRs (031–034) + sincronizar docs com código | 3 dias | ✅ Concluído — 29 Jul 2026 |
| **VOL04-7** | QA: smoke tests + DoD check + fechar volume | 2 dias | ✅ Concluído — 29 Jul 2026 |

**Total estimado:** 8 sprints · ~5 semanas · Agosto 2026

---

## Dívidas Técnicas Resolvidas neste Volume

| ID | Dívida | Impacto | Sprint |
|---|---|---|---|
| DT-013 | TOCTOU no conflict check de reservas (PATCH sem tx serializable) | Crítico | VOL04-1 |
| DT-017 | recordFinancialHistory fora de contexto tx (chamado dentro de $transaction) | Crítico | VOL04-1 |
| — | Sem Zod em POST /api/reservations | Alto | VOL04-1 |
| — | Sem state machine formal (qualquer status → qualquer status) | Alto | VOL04-1 |
| — | RoomPricing vs MeetingPlan: dois sistemas de preços sem hierarquia clara | Médio | VOL04-3 |
| — | PUT /api/admin/room-settings sem validação de horários (openTime < closeTime) | Médio | VOL04-3 |
| — | Sem testes unitários para lógica de reservas | Crítico | VOL04-4 |

---

## ADRs Propostos

| ADR | Decisão | Estado |
|---|---|---|
| [ADR-031](../adr/ADR-031-reservation-state-machine.md) | State machine de reservas: transições válidas e estados terminais | ✅ ACEITE |
| [ADR-032](../adr/ADR-032-serializable-conflict-check.md) | Conflict check em $transaction Serializable — elimina TOCTOU (DT-013) | ✅ ACEITE |
| [ADR-033](../adr/ADR-033-post-commit-financial-history.md) | Post-commit para recordFinancialHistory — auditoria não bloqueia tx (DT-017) | ✅ ACEITE |
| [ADR-034](../adr/ADR-034-meetingplan-pricing-ssot.md) | MeetingPlan como SSoT de pricing; RoomPricing marcado como LEGADO | ✅ ACEITE |

---

## Definition of Done — VOL04 (verificado em 29 Jul 2026)

```
✅ DT-013 resolvido: PATCH de horário em $transaction Serializable (ADR-032)
✅ DT-017 resolvido: recordFinancialHistory chamado APÓS commit (ADR-033)
✅ State machine: toda transição de status validada (reservation-state-machine.ts)
✅ Política de cancelamento: isCancellationFree() + CANCELLATION_FREE_HOURS=24
✅ Auto-conclusão: cron diário POST /api/cron/reservations-close (WAT 03:00)
✅ Admin availability: GET /api/reservations/availability?date=YYYY-MM-DD
✅ Testes unitários VOL04: 183 casos em 7 ficheiros (state-machine, conflict,
   cancellation, availability, plan-validators, pricing-service, integration)
✅ Testes de integração: ciclo completo (36 casos puros — sem BD)
✅ Documentação sincronizada: api.md, business-rules.md, testing.md com ✅
✅ ADRs 031–034 criados e marcados ACEITE
✅ tsc --noEmit: zero erros em ficheiros VOL04 (erros pré-existentes VOL03 — ver abaixo)
✅ Lógica core validada com node -e: 22+4+10+12 = 48 casos directo

⚠️  Nota QA: Erros tsc pré-existentes do VOL03 em portal-notifications-retry/route.ts,
    portal-sla-check/route.ts e portal-auth-service.ts. Causa: expressão cron
    "*/5 * * * *" dentro de JSDoc fecha o bloco de comentário (DT-035 — registar).
    Nenhum destes ficheiros é do VOL04. Não bloqueia conclusão.
```

---

*VD Platform — Volume 04 — README — 29 Julho 2026*  
*Especificação aguarda aprovação formal do Product Owner antes de qualquer implementação*
