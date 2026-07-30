# Regras de Negócio — Reservas

> **Volume:** 04  
> **Estado:** ✅ Implementado — VOL04-1 concluído (29 Jul 2026)  
> **Data:** 29 Julho 2026

---

## 1. Conflict Check (BR-RES-001, BR-RES-002)

### Fórmula de sobreposição

```
CONFLITO se: existStart < newEnd  AND  existEnd > newStart
SEM conflito: existEnd === newStart  (intervalos adjacentes — permitido)
```

**Exemplo:**
```
Reserva existente: 09:00 → 12:00
Nova reserva A:    12:00 → 14:00  → SEM conflito (adjacent)
Nova reserva B:    11:00 → 13:00  → CONFLITO
Nova reserva C:    08:00 → 09:00  → SEM conflito (anterior)
Nova reserva D:    08:30 → 09:30  → CONFLITO
```

### Implementação obrigatória

```typescript
// SEMPRE dentro de $transaction(isolationLevel: Serializable)
const conflict = await tx.reservation.findFirst({
  where: {
    status:  { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
    planId:  newPlanId,  // mesmo plano/sala
    AND: [
      { startDatetime: { lt: newEnd   } },
      { endDatetime:   { gt: newStart } },
    ],
    // Para PATCH: excluir a própria reserva
    // id: { not: reservationId },
  },
});
if (conflict) throw new ReservationConflictError();
```

**Estados que bloqueiam slot:**
- `CONFIRMADA` ✅
- `RESERVADO` ✅
- `PENDENTE_APROVACAO` ✅

**Estados que libertam slot:**
- `CANCELADA` — slot fica livre
- `CONCLUIDA` — slot passou, irrelevante para novos pedidos

---

## 2. State Machine Formal (BR-RES-001 a BR-RES-009)

### Diagrama de estados

```
                    ┌─────────────────────────────────────┐
                    │                                     │
             [PENDENTE_APROVACAO]               [RESERVADO]
             (custom pricing)                  (pagar no dia)
                    │                                     │
             approve│reject                   confirm│cancel
                    │         ┌───────────────┘       │
                    ▼         ▼                        │
              [CONFIRMADA] ◄──┘                        │
              (pagar agora|facturar|isento|approved)   │
                    │                                  │
          ┌─────────┴─────────┐                       │
          ▼                   ▼                        ▼
    [CONCLUIDA]         [CANCELADA] ◄─────────────────┘
    (após evento)       (terminal)
```

### Transições permitidas por actor

| Actor | Transições autorizadas |
|---|---|
| ADMIN | Todas as transições |
| COMERCIAL | PENDENTE_APROVACAO → CANCELADA · RESERVADO → CANCELADA · RESERVADO → CONFIRMADA |
| FINANCEIRO | RESERVADO → CONFIRMADA (após pagamento) |
| Sistema (cron) | CONFIRMADA → CONCLUIDA |

### Validação no servidor

```typescript
// src/lib/reservation-state-machine.ts
type ReservationStatus =
  | "PENDENTE_APROVACAO"
  | "RESERVADO"
  | "CONFIRMADA"
  | "CONCLUIDA"
  | "CANCELADA";

const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDENTE_APROVACAO: ["CONFIRMADA", "CANCELADA"],
  RESERVADO:          ["CONFIRMADA", "CANCELADA"],
  CONFIRMADA:         ["CONCLUIDA",  "CANCELADA"],
  CONCLUIDA:          [],   // terminal
  CANCELADA:          [],   // terminal
};

export function canTransition(
  from: ReservationStatus,
  to:   ReservationStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Transição inválida: ${from} → ${to}`);
  }
}
```

Toda API de PATCH de status DEVE chamar `canTransition` antes de persistir.

---

## 3. Política de Cancelamento (BR-RES-005)

```
CANCELAMENTO_ANTES_24H  → reembolso total se pago
                          estado: CANCELADA | paymentStatus: REEMBOLSADO (futuro)

CANCELAMENTO_MENOS_24H  → sem reembolso (taxa 100%)
                          estado: CANCELADA | paymentStatus mantido (PAGO)
                          nota: "Cancelamento < 24h — sem reembolso"

NO-SHOW                 → registado em D+1 pelo cron
                          estado: CONCLUIDA | paymentStatus: SEM_COMPARECIA
```

### Constante global

```typescript
export const CANCELLATION_FREE_HOURS = 24; // horas antes do evento para cancelamento gratuito

export function isCancellationFree(startDatetime: Date): boolean {
  const hoursUntilEvent = (startDatetime.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilEvent >= CANCELLATION_FREE_HOURS;
}
```

### API de cancelamento

```
PATCH /api/reservations/[id]
  body: { status: "CANCELADA", cancellationReason: "..." }

Resposta inclui:
  refundable: boolean  — se o cliente tem direito a reembolso
  hoursUntilEvent: number
  policy: "FREE" | "NO_REFUND"
```

---

## 4. Auto-conclusão (BR-RES-009)

Cron diário (`/api/cron/reservations-close`) executado às 03:00 WAT:

```typescript
// Implementação real (VOL04-2B): iteração individual para publicar eventos
const toClose = await prisma.reservation.findMany({
  where: { status: "CONFIRMADA", endDatetime: { lt: new Date() } },
  select: { id: true, reservationNumber: true, eventName: true, companyId: true },
});

for (const r of toClose) {
  await prisma.reservation.update({ where: { id: r.id }, data: { status: "CONCLUIDA" } });
  publish("reservation.completed", { ...r }).catch(console.error);
}
```

**Nota:** não gera Timeline (evento de conclusão é silencioso para evitar ruído).  
O evento `reservation.completed` é publicado APÓS cada `update` individual (padrão post-commit — ADR-033).

---

## 5. Regras de Preços (BR-RES-006, BR-RES-007)

### Motor de cálculo

```typescript
// Único motor de preços — baseado em MeetingPlan
function calculateReservationAmount(
  plan:        MeetingPlan,
  totalHours:  number,
  coffeeBreak: boolean,
  isWeekend:   boolean
): { amount: number; breakdown: string } {
  let base: number;

  if (isWeekend && plan.weekendPrice > 0) {
    base = plan.weekendPrice;
  } else if (totalHours >= 6 && plan.fullDayPrice > 0) {
    base = plan.fullDayPrice;                              // fullDay: ≥ 6h
  } else if (totalHours >= 3 && plan.halfDayPrice > 0 && plan.halfDayPrice < plan.pricePerHour * totalHours) {
    base = plan.halfDayPrice;                              // halfDay: ≥ 3h E mais barato que horário
  } else {
    base = plan.pricePerHour * totalHours;
  }

  const coffeeBreakTotal = coffeeBreak ? plan.coffeeBreakPrice : 0;
  return {
    amount:    base + coffeeBreakTotal,
    breakdown: `${totalHours}h × ${plan.pricePerHour} Kz/h (base: ${base} Kz)${coffeeBreak ? ` + Coffee Break: ${plan.coffeeBreakPrice} Kz` : ""}`,
  };
}
```

### Desconto máximo

```typescript
// maxDiscount vem de RoomSettings (configurável pelo ADMIN)
// COMERCIAL: limitado a maxDiscount
// ADMIN: pode ultrapassar maxDiscount (excepção autorizada)
if (role !== "ADMIN" && discount > settings.maxDiscount / 100 * amount) {
  return NextResponse.json(
    { error: `Desconto máximo permitido: ${settings.maxDiscount}%` },
    { status: 422 }
  );
}
```

### IVA

```typescript
// IVA configurável por reserva; default vem de RoomSettings.defaultIva
// totalAmount = (amount - discount) * (1 + iva / 100)
const totalAmount = (amount - discount) * (1 + iva / 100);
```

---

## 6. Regras RBAC (BR-RES — complemento)

| Operação | ADMIN | COMERCIAL | FINANCEIRO | VIEWER |
|---|---|---|---|---|
| Criar reserva | ✅ | ✅ | ❌ | ❌ |
| Editar reserva (campos gerais) | ✅ | ✅ | ❌ | ❌ |
| Editar horário (TOCTOU tx) | ✅ | ✅ | ❌ | ❌ |
| Confirmar pagamento | ✅ | ❌ | ✅ | ❌ |
| Cancelar reserva | ✅ | ✅ (< 24h apenas ADMIN) | ❌ | ❌ |
| Aprovar preço personalizado | ✅ | ❌ | ❌ | ❌ |
| Ver reservas | ✅ | ✅ | ✅ | ✅ |
| Gerir planos (MeetingPlan) | ✅ | ❌ | ❌ | ❌ |
| Gerir configurações | ✅ | ❌ | ❌ | ❌ |
| Ver relatórios | ✅ | ✅ | ✅ | ❌ |
| Exportar relatórios | ✅ | ✅ | ✅ | ❌ |

---

## 7. Numeração de Documentos

```
RES-YYYY-NNNNNN   → Número de reserva (atribuído na criação)
FT-SALA-YYYY-NNNNNN → Fatura de sala
REC-YYYY-NNNNNN   → Recibo de pagamento
NL-YYYY-NNNNNN    → Nota de liquidação
```

Todos via `nextDocumentNumber(tx, type)` — atómico dentro de `$transaction`.  
`reservationNumber` é **imutável** após criação (nunca alterar em PATCH).

---

## 8. Integração com outros módulos

### Event Bus

```typescript
// Eventos publicados pelo módulo de Reservas
"reservation.created"    → { reservationId, eventName, companyId?, responsible, startDatetime, totalAmount }
"reservation.confirmed"  → { reservationId, eventName, companyId?, responsible, startDatetime }
"reservation.cancelled"  → { reservationId, eventName, companyId?, cancellationReason?, refundable }
"reservation.completed"  → { reservationId, eventName, companyId?, endDatetime }
"reservation.payment_received" → { reservationId, reservationNumber, amount, method, receivedBy }
```

### Timeline (BR-RES-008)

Criada SOMENTE quando `companyId` está presente:

```typescript
// Chamada APÓS commit da transacção (nunca dentro de $transaction)
if (companyId) {
  await addTimeline(prisma, {
    type:          "RESERVA_CRIADA",
    title:         `Reserva ${reservationNumber}`,
    description:   `${plan.name} | ${totalHours}h | ${formatDate(startDatetime)}`,
    companyId,
    referenceId:   reservationId,
    referenceType: "Reservation",
    createdBy:     session.name || session.email,
  });
}
```

---

*VD Platform — Volume 04 — business-rules.md — 29 Julho 2026*  
*Especificação aguarda aprovação formal do Product Owner*
