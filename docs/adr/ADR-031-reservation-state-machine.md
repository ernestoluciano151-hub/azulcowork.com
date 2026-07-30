# ADR-031 — State Machine Formal para Reservation.status

**Estado:** ACEITE  
**Data:** 2026-07-29  
**Decisores:** Ernesto Pinto Luciano  
**Volume:** VOL04 — Reservas  
**Implementado em:** `src/lib/reservation-state-machine.ts`

---

## Contexto

O módulo de Reservas existia sem qualquer validação de transições de estado. O campo `status` aceitava qualquer valor em qualquer PATCH — era possível transitar de `CONCLUIDA` para `RESERVADO`, de `CANCELADA` para `CONFIRMADA`, ou saltar directamente de `PENDENTE_APROVACAO` para `CONCLUIDA`. Isto representava um risco de integridade de dados e de fraude operacional.

O sistema precisa de garantir que:
1. Reservas terminais (`CONCLUIDA`, `CANCELADA`) não podem ser reactivadas
2. A progressão de estados é sempre linear e auditável
3. Qualquer tentativa de transição inválida retorna HTTP 422 (Unprocessable Entity)

---

## Decisão

Criar `src/lib/reservation-state-machine.ts` com:

- **`VALID_TRANSITIONS`**: tabela de transições permitidas por estado
- **`OCCUPYING_STATUSES`**: estados que bloqueiam slot para conflict check
- **`canTransition(from, to)`**: função pura de verificação
- **`assertValidTransition(from, to)`**: lança `InvalidStatusTransitionError` se inválida
- **`CANCELLATION_FREE_HOURS = 24`**: constante da política de cancelamento
- **`isCancellationFree(startDatetime, now?)`**: verifica elegibilidade de reembolso

**Transições válidas:**
```
PENDENTE_APROVACAO → CONFIRMADA | CANCELADA
RESERVADO          → CONFIRMADA | CANCELADA
CONFIRMADA         → CONCLUIDA  | CANCELADA
CONCLUIDA          → (nenhuma — terminal)
CANCELADA          → (nenhuma — terminal)
```

A verificação de estado é feita **antes** de qualquer escrita na base de dados, no handler `PATCH /api/reservations/[id]`, retornando HTTP 422 em caso de transição inválida.

---

## Alternativas Consideradas

### A. Validação inline por handler
Cada route verificaria os estados permitidos com lógica `if/switch` própria.

**Rejeitada:** duplicação, inconsistência entre handlers, impossibilidade de testar unitariamente a lógica de transição.

### B. Validação a nível de Prisma (middleware)
Adicionar um Prisma middleware que interceta updates a `status`.

**Rejeitada:** o Prisma middleware não tem acesso ao estado anterior sem uma query extra; adiciona complexidade sem benefício sobre a solução escolhida; dificulta testes.

### C. State machine de biblioteca (XState)
Usar uma biblioteca externa de state machines.

**Rejeitada:** dependência externa para lógica simples; o grafo tem 5 estados e 6 transições — não justifica a sobrecarga de configuração.

---

## Consequências

### Positivas
- Impossível criar transições inválidas via API (garantia a nível de servidor)
- Lógica testável unitariamente sem mock de base de dados (37 testes)
- Tabela de transições serve como documentação executável
- `OCCUPYING_STATUSES` unificado — conflict check e state machine usam a mesma fonte

### Negativas
- O handler deve buscar o estado actual antes de executar o PATCH (1 query extra em writes de status)
- Novos estados ou transições exigem actualização do ficheiro e dos testes

---

## Revisão

Rever se for adicionado estado `NO_SHOW` (VOL04-2 futuro) ou se a política de cancelamento mudar de 24h.

---

*VD Platform — ADR-031 — 29 Julho 2026*
