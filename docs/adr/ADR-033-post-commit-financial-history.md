# ADR-033 — Post-Commit Pattern para recordFinancialHistory (DT-017)

**Estado:** ACEITE  
**Data:** 2026-07-29  
**Decisores:** Ernesto Pinto Luciano  
**Volume:** VOL04 — Reservas  
**Corrige:** DT-017  
**Implementado em:** `src/app/api/reservations/route.ts` · `src/app/api/reservations/[id]/receive-payment/route.ts`

---

## Contexto

`recordFinancialHistory()` escrevia registos de histórico financeiro **dentro** de um `prisma.$transaction()`, usando o cliente de transacção `tx`:

```typescript
// ANTES (errado) — DT-017
await prisma.$transaction(async (tx) => {
  const reservation = await tx.reservation.create({ ... });
  await tx.payment.create({ ... });
  await recordFinancialHistory(tx, { ... }); // usa tx — problema!
});
```

**O problema:** se `recordFinancialHistory` falhar (por qualquer razão — dados inválidos, constraint violada, timeout), toda a transacção principal faz rollback. A reserva e o pagamento são desfeitos por um erro num registo de auditoria — impacto desproporcional sobre a operação principal.

O histórico financeiro é uma preocupação secundária (auditoria/reporting). Não deve bloquear nem comprometer a operação principal.

Adicionalmente, `recordFinancialHistory` chamada com `tx` pode prolongar a duração da transacção principal, aumentando a contenção.

---

## Decisão

**`recordFinancialHistory` é chamada APÓS o `await prisma.$transaction()` ter concluído com sucesso, usando o cliente `prisma` (não `tx`), com `.catch()` para absorver falhas silenciosamente.**

```typescript
// DEPOIS (correcto) — padrão post-commit
const result = await prisma.$transaction(async (tx) => {
  const reservation = await tx.reservation.create({ ... });
  const payment     = await tx.payment.create({ ... });
  return { reservation, payment };
});

// Fora da tx — após commit bem-sucedido
recordFinancialHistory(prisma, {
  companyId:      result.reservation.companyId!,
  type:           "SALA_REUNIAO",
  description:    `Reserva ${result.reservation.reservationNumber}`,
  amount:         result.payment.amount,
  runningBalance: 0,
}).catch((err) => {
  console.error("[FinancialHistory] Failed to record after reservation:", err);
  // Não relança — não afecta a resposta HTTP ao cliente
});
```

**Regras do padrão:**
1. `recordFinancialHistory` NUNCA usa o cliente `tx`
2. SEMPRE chamada após `await $transaction()`
3. SEMPRE com `.catch()` — falha de auditoria não expõe erro ao cliente
4. O `console.error` garante observabilidade sem bloquear a operação

---

## Alternativas Consideradas

### A. Manter dentro da transacção (comportamento actual)
A falha de auditoria desfaz a reserva e o pagamento.

**Rejeitada:** comportamento incorrecto — um erro de auditoria não justifica reverter uma transacção financeira já validada.

### B. Transacção separada e independente (`savepoint` / transacção nova)
Abrir uma nova transacção isolada só para `recordFinancialHistory`.

**Considerada:** correcto em teoria, mas mais complexo. O padrão `.catch()` oferece o mesmo isolamento de falhas com menos código.

### C. Event-driven via `publish()` (event bus)
Publicar um evento `"financial.history.create"` e processar de forma assíncrona num handler.

**Considerada:** correcta para arquitecturas event-driven maduras. O VD Platform publica eventos `reservation.created`, mas a infra de event handlers ainda não tem persistência garantida (DT-009 — sem Sentry / retry). Risco de perda de eventos. A adoptar quando DT-009 for resolvido.

### D. Queue de background jobs (BullMQ / pgBoss)
Encomendar o registo de histórico a um worker assíncrono.

**Rejeitada:** dependência de infraestrutura adicional não justificada para este caso de uso.

---

## Consequências

### Positivas
- `recordFinancialHistory` nunca faz rollback de operações financeiras
- A reserva e o pagamento chegam ao cliente sem dependência da auditoria
- Padrão simples, sem dependências novas
- `.catch()` garante que falhas de auditoria ficam observáveis nos logs mas silenciosas para o utilizador

### Negativas
- Possibilidade teórica de registar a reserva mas não o histórico financeiro (inconsistência eventual)
- Falhas em `recordFinancialHistory` são visíveis apenas em logs — requer monitorização (DT-009)
- O histórico não é garantido se o processo do servidor morrer entre o commit e a chamada

### Mitigação
Quando DT-009 for resolvido (Sentry + alertas), configurar alerta em `[FinancialHistory] Failed` para detectar inconsistências.

---

## Revisão

Rever quando o event bus (DT-009) tiver retry/persistência garantida — migrar para publicação de evento `"financial.history.create"` com consumer dedicado.

---

*VD Platform — ADR-033 — 29 Julho 2026*
