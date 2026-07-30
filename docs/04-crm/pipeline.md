# CRM — Pipeline, Lead Lifecycle & Company Lifecycle

> **Versão:** 1.0.0-draft  
> **Volume:** 01 — CRM  
> **Estado:** 📝 Em elaboração  
> **Dependências:** [customer360.md](./customer360.md), [data-model.md](./data-model.md)

---

## 1. Visão Geral do Pipeline

O Pipeline CRM do VD Platform é o mecanismo que controla a progressão de uma empresa desde o primeiro contacto até ao fecho do negócio (ganho ou perdido). É visualizado como um **Kanban** e gerido como uma **máquina de estados**.

### Princípios do Pipeline

- **Cada coluna é um stage** — stages são enum Prisma, não configuráveis pelo utilizador (L1/L2).
- **A empresa move-se, não o deal** — o `pipelineStage` da Company reflecte o stage do Deal mais avançado activo.
- **Um Deal por stage crítico** — só pode existir um Deal em `NEGOTIATION` por empresa (BR-CRM-007).
- **Toda transição é auditada** — cada mudança de stage gera `TimelineEntry` e `AuditLog`.
- **Retrogressão é permitida** — ex.: `NEGOTIATION → PROPOSAL_SENT` se a proposta precisar de ser revista.

---

## 2. Pipeline Stages — Detalhes

### NEW_LEAD

```
Critério de entrada:  Company criada no sistema (qualquer origem)
Critério de saída:    Primeiro contacto realizado (Activity logged)
Responsável:          COMERCIAL ou ADMIN
SLA:                  Primeiro contacto em ≤ 24h úteis
Acções obrigatórias:  Atribuir responsável, verificar dados básicos (NIF, email, telefone)
Eventos gerados:      company.created, lead.captured
```

### CONTACTED

```
Critério de entrada:  Activity do tipo CALL, EMAIL ou MEETING registada
Critério de saída:    Qualificação BANT concluída (Budget, Authority, Need, Timing)
Responsável:          COMERCIAL
SLA:                  Qualificação em ≤ 5 dias úteis após primeiro contacto
Acções obrigatórias:  Registar outcome do contacto, agendar follow-up
Eventos gerados:      activity.logged, lead.contacted
```

### QUALIFIED

```
Critério de entrada:  Lead qualificado: Budget confirmado, Decisor identificado,
                      Necessidade clara, Timing definido
Critério de saída:    Proposta preparada e enviada
Responsável:          COMERCIAL
SLA:                  Proposta enviada em ≤ 3 dias úteis após qualificação
Acções obrigatórias:  Criar Deal com valor estimado, preparar proposta personalizada
Eventos gerados:      lead.qualified, deal.created
```

### PROPOSAL_SENT

```
Critério de entrada:  Proposta formal enviada ao cliente (Document gerado)
Critério de saída:    Cliente responde (positivo → NEGOTIATION, negativo → LOST)
Responsável:          COMERCIAL
SLA:                  Follow-up em ≤ 3 dias úteis sem resposta
Acções obrigatórias:  Registar envio da proposta, agendar follow-up automático
Eventos gerados:      proposal.sent, task.created (follow-up automático)
```

### NEGOTIATION

```
Critério de entrada:  Cliente manifestou interesse, a negociar termos e condições
Critério de saída:    Decisão tomada (WON ou LOST)
Responsável:          COMERCIAL + ADMIN (para descontos > 10%)
SLA:                  Decisão esperada em ≤ 14 dias úteis
Acções obrigatórias:  Registar cada iteração de negociação como Activity
                      Descontos > 10% requerem aprovação de ADMIN
Eventos gerados:      negotiation.started, activity.logged (por iteração)
```

### WON

```
Critério de entrada:  Contrato assinado ou acordo verbal confirmado por escrito
Critério de saída:    N/A (estado terminal positivo)
Responsável:          COMERCIAL + ADMIN
Acções obrigatórias:  Marcar deal.closedAt, actualizar company.status → ACTIVE,
                      criar contrato, activar onboarding
Eventos gerados:      deal.won, company.statusChanged (→ ACTIVE), contract.created
```

### LOST

```
Critério de entrada:  Negócio não concretizado (cliente recusou ou desapareceu)
Critério de saída:    N/A (estado terminal negativo — mas reversível via re-engagement)
Responsável:          COMERCIAL
Acções obrigatórias:  Registar lostReason (obrigatório), agendar re-engagement
                      se aplicável
Motivos de perda (enum):
  PRICE_TOO_HIGH | CHOSE_COMPETITOR | NO_BUDGET | NO_NEED | TIMING |
  NO_RESPONSE | OTHER
Eventos gerados:      deal.lost, lead.disqualified
```

### DISQUALIFIED

```
Critério de entrada:  Lead não é um potencial cliente adequado (sem budget,
                      sector errado, tamanho incompatível, etc.)
Critério de saída:    Empresa arquivada (deletedAt ou status CHURNED)
Responsável:          COMERCIAL
Acções obrigatórias:  Registar motivo de desqualificação
Eventos gerados:      lead.disqualified
```

---

## 3. Diagrama do Pipeline (Kanban)

```
┌──────────┬───────────┬───────────┬──────────────┬─────────────┬────────┬──────────┐
│ NEW LEAD │ CONTACTED │ QUALIFIED │PROPOSAL SENT │ NEGOTIATION │  WON   │   LOST   │
│    (3)   │    (7)    │    (4)    │     (2)      │     (1)     │  (12)  │   (5)    │
├──────────┼───────────┼───────────┼──────────────┼─────────────┼────────┼──────────┤
│[Empresa A│[Empresa D │[Empresa G │[Empresa J    │[Empresa K   │(total) │(total)   │
│ João S.  │ Ana C.    │ Pedro M.  │ Sofia L.     │ Rui N.      │        │          │
│ 0 dias]  │ 2 dias]   │ 1 dia]    │ 3 dias]      │ 8 dias]     │        │          │
│          │           │           │              │             │        │          │
│[Empresa B│[Empresa E │[Empresa H │[Empresa L    │             │        │          │
│ Ana C.   │ Pedro M.  │ João S.   │ Ana C.       │             │        │          │
│ 1 dia]   │ 5 dias]   │ 4 dias]   │ 6 dias]      │             │        │          │
│          │           │           │              │             │        │          │
│[Empresa C│[Empresa F │[Empresa I │              │             │        │          │
│ Rui N.   │ Sofia L.  │ Rui N.    │              │             │        │          │
│ 3 dias]  │ 7 dias]   │ 2 dias]   │              │             │        │          │
└──────────┴───────────┴───────────┴──────────────┴─────────────┴────────┴──────────┘
  ↓ Valor     ↓ Valor    ↓ Valor    ↓ Valor        ↓ Valor
  total       total      total      total           total

KPIs visíveis no topo:
Conversion Rate: 70.6%  |  Avg Cycle Time: 22d  |  Pipeline Value: 4.250.000 Kz
```

---

## 4. Fluxo de Transição de States

### Transições permitidas

| De | Para | Condição | Evento |
|---|---|---|---|
| `NEW_LEAD` | `CONTACTED` | Activity registada | `lead.contacted` |
| `NEW_LEAD` | `DISQUALIFIED` | Motivo registado | `lead.disqualified` |
| `CONTACTED` | `QUALIFIED` | BANT preenchido | `lead.qualified` |
| `CONTACTED` | `LOST` | Contacto sem resposta (> 30d) | `deal.lost` |
| `CONTACTED` | `DISQUALIFIED` | Motivo registado | `lead.disqualified` |
| `QUALIFIED` | `PROPOSAL_SENT` | Documento de proposta criado | `proposal.sent` |
| `QUALIFIED` | `LOST` | Desistência antes de proposta | `deal.lost` |
| `PROPOSAL_SENT` | `NEGOTIATION` | Feedback positivo do cliente | `negotiation.started` |
| `PROPOSAL_SENT` | `LOST` | Cliente recusou proposta | `deal.lost` |
| `PROPOSAL_SENT` | `QUALIFIED` | Proposta precisa de revisão | `proposal.revised` |
| `NEGOTIATION` | `WON` | Contrato assinado | `deal.won` |
| `NEGOTIATION` | `LOST` | Negociação falhada | `deal.lost` |
| `NEGOTIATION` | `PROPOSAL_SENT` | Volta a proposta (retrogressão) | `proposal.revised` |
| `LOST` | `NEW_LEAD` | Re-engagement iniciado | `lead.reengaged` |
| `DISQUALIFIED` | `NEW_LEAD` | Reclassificação | `lead.reclassified` |

### Transições proibidas

| De | Para | Motivo |
|---|---|---|
| `WON` | qualquer stage | Deal ganho é imutável — novo Deal necessário |
| qualquer | `WON` | Só via `deal.won` (requer closedAt e lostReason nulo) |
| `MERGED` | qualquer | Empresa merged é imutável |

---

## 5. Follow-up Engine

### Regras de Follow-up Automático

O sistema cria automaticamente Tasks de follow-up nas seguintes situações:

| Trigger | Task criada | Prazo | Prioridade |
|---|---|---|---|
| Lead em `NEW_LEAD` há > 4h sem Activity | "Fazer 1.º contacto com [Empresa]" | +20h | HIGH |
| Lead em `PROPOSAL_SENT` há > 3 dias | "Follow-up proposta para [Empresa]" | +1d | MEDIUM |
| Lead em `PROPOSAL_SENT` há > 7 dias | "Follow-up urgente proposta [Empresa]" | hoje | HIGH |
| Task vencida há > 24h | "Tarefa vencida: [título original]" (nova task) | hoje | URGENT |
| `company.nextFollowUpAt` atingido | "Follow-up agendado: [Empresa]" | hoje | MEDIUM |

### Follow-up Manual

O utilizador pode agendar um follow-up manual a partir de:
- Vista Customer 360° → botão "Agendar Follow-up"
- Vista Pipeline Kanban → card da empresa → "Follow-up"
- Ao registar uma Activity → campo "Próxima acção"

---

## 6. KPIs do Pipeline

| Métrica | Fórmula | Frequência de actualização |
|---|---|---|
| **Conversion Rate** | `WON / (WON + LOST) * 100` | Tempo real |
| **Avg Deal Cycle Time** | `AVG(closedAt - deal.createdAt) WHERE WON` | Diária |
| **Pipeline Value** | `SUM(deal.value) WHERE stage NOT IN [WON, LOST]` | Tempo real |
| **Avg Deal Value** | `AVG(deal.value) WHERE WON` | Diária |
| **Win Rate by Stage** | `WON / total_entered_stage * 100` por stage | Semanal |
| **Deals by Owner** | `COUNT(*) GROUP BY assignedToId` | Tempo real |
| **Overdue Follow-ups** | `COUNT(tasks) WHERE overdue AND type=follow-up` | Tempo real |
| **Avg Time per Stage** | `AVG(time spent in stage)` por stage | Semanal |

---

## 7. Regras de Negócio do Pipeline

| ID | Regra |
|---|---|
| BR-PIPE-001 | Toda company entra no pipeline com `NEW_LEAD`, nunca num stage avançado |
| BR-PIPE-002 | A transição para `NEGOTIATION` requer um Deal criado com `value > 0` |
| BR-PIPE-003 | A transição para `WON` requer `deal.closedAt` e `deal.value > 0` |
| BR-PIPE-004 | A transição para `LOST` requer `deal.lostReason` preenchido (obrigatório) |
| BR-PIPE-005 | Só um Deal pode estar em `NEGOTIATION` por empresa (BR-CRM-007) |
| BR-PIPE-006 | Descontos superiores a 10% requerem aprovação de um utilizador `ADMIN` |
| BR-PIPE-007 | O `assignedTo` do pipeline é sempre um utilizador `COMERCIAL` ou `ADMIN` |
| BR-PIPE-008 | Um Deal `WON` não pode ser reaberto — deve criar-se um novo Deal |

---

*VD Platform — CRM Pipeline — v1.0.0-draft — 28 Julho 2026*  
*© 2026 VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA. Confidencial.*
