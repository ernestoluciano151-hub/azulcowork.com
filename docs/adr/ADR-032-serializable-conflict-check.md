# ADR-032 — $transaction Serializable para Conflict Check de Reservas (DT-013)

**Estado:** ACEITE  
**Data:** 2026-07-29  
**Decisores:** Ernesto Pinto Luciano  
**Volume:** VOL04 — Reservas  
**Corrige:** DT-013  
**Implementado em:** `src/app/api/reservations/route.ts` · `src/app/api/reservations/[id]/route.ts` · `src/app/api/room-booking-leads/[id]/to-reservation/route.ts`

---

## Contexto

O endpoint `PATCH /api/reservations/[id]` executava o conflict check (verificação de sobreposição de slots) **fora** de uma transacção, com um `findFirst` separado antes do `update`. Isto criava uma janela de tempo vulnerável a race conditions (TOCTOU — Time-of-Check to Time-of-Use):

```
Thread A: findFirst → sem conflito
Thread B: findFirst → sem conflito
Thread A: create/update → persiste
Thread B: create/update → persiste (DUPLO BOOKING)
```

Em contexto de múltiplos utilizadores simultâneos (comerciais + portal), este cenário é possível, especialmente em datas de alta procura.

---

## Decisão

**Todo o conflict check é executado DENTRO de `prisma.$transaction()` com nível de isolamento `Serializable`.**

```typescript
prisma.$transaction(async (tx) => {
  // 1. Conflict check
  const conflict = await tx.reservation.findFirst({
    where: {
      status: { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
      AND: [{ startDatetime: { lt: newEnd } }, { endDatetime: { gt: newStart } }],
    },
  });
  if (conflict) throw new ReservationConflictError(); // → HTTP 409

  // 2. Escrita atómica
  return tx.reservation.create({ ... });
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
```

**Para PATCH (edição de horário):** a transacção serializable só é usada quando `startDatetime` ou `endDatetime` mudam. Actualizações de outros campos (status, notas, dados do evento) não passam pela transacção serializable — reduz contenção desnecessária.

**Tratamento de `P2034` (serialization failure):** capturado e retornado como HTTP 409 com mensagem "Tente novamente".

---

## Alternativas Consideradas

### A. Pessimistic locking (`SELECT FOR UPDATE`)
Bloquear a linha do plano/sala antes do conflict check.

**Rejeitada:** o Prisma 5 não suporta `SELECT FOR UPDATE` directamente (requer raw SQL); acresce complexidade de desbloquear correctamente em caso de erro.

### B. Advisory lock de aplicação (Redis / in-memory)
Usar um lock externo por `planId + data` antes da escrita.

**Rejeitada:** introduz dependência de Redis ou serviço externo; distribui a lógica de concorrência entre o servidor de app e a infraestrutura; complexidade de gestão de expiração de locks.

### C. Índice UNIQUE no schema
Criar um índice UNIQUE que rejeite duplicados a nível de BD.

**Rejeitada:** o conflito não é de campos únicos — é de intervalos sobrepostos. Não é modelável por UNIQUE index (requereria exclusion constraints do PostgreSQL, não suportadas pelo Prisma ORM).

### D. Manter aplicação single-threaded com queue
Processar criações de reserva em fila (um de cada vez por sala).

**Rejeitada:** escala mal; latência adicional para o utilizador; complexidade operacional.

---

## Consequências

### Positivas
- Elimina completamente o double-booking por race condition
- Solução puramente a nível de base de dados — sem dependências externas
- `P2034` (retry) é raro em operações rápidas (escritas simples)
- Implementação clara e testável

### Negativas
- Maior contenção a nível de BD em picos de tráfego (muitas reservas simultâneas no mesmo plano)
- `P2034` requer retry no cliente — UX de "Tente novamente" é aceitável para reservas
- Transacções serializable com muitas queries dentro podem degradar performance

---

## Revisão

Rever se o volume de reservas simultâneas crescer significativamente (>50 concurrent writes/segundo por plano). Nesse cenário, avaliar queue por sala.

---

*VD Platform — ADR-032 — 29 Julho 2026*
