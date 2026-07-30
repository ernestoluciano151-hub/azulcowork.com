# API Reference — Reservas

> **Volume:** 04  
> **Estado:** 📋 Especificação — Aguarda aprovação PO  
> **Data:** 29 Julho 2026

---

## Inventário Completo de APIs

### Legenda de estado

| Símbolo | Significado |
|---|---|
| ✅ | Existe e funciona |
| ⚠️ | Existe com problemas (dívida técnica) |
| 🔧 | Existe — requer hardening em VOL04-1 |
| 🆕 | Nova — a criar em VOL04 |

---

## API de Reservas

### `GET /api/reservations`
**Estado:** ✅  
**Auth:** ADMIN | COMERCIAL | FINANCEIRO  
**Query:** `from`, `to`, `status`, `paymentStatus`, `companyId`, `page`, `limit`  
**Resposta:** `{ reservations[], total, page, limit }`  
**Observações:** Paginação correcta; include plan + company.

---

### `POST /api/reservations`
**Estado:** ✅ Hardened (VOL04-1 — 29 Jul 2026)  
**Auth:** ADMIN | COMERCIAL  
**Body:**
```typescript
{
  eventName:       string;           // obrigatório
  responsible:     string;           // obrigatório
  planId:          string;           // obrigatório
  startDatetime:   string;           // ISO 8601 — obrigatório
  endDatetime:     string;           // ISO 8601 — obrigatório
  companyName?:    string;           // cliente externo
  companyId?:      string;           // cliente coworking
  email?:          string;
  whatsapp?:       string;
  participants?:   number;
  coffeeBreak?:    boolean;
  observations?:   string;
  isCustomPricing?:boolean;
  customRequest?:  string;
  paymentOption:   "PAGAR_AGORA" | "PAGAR_NO_DIA" | "FACTURAR" | "ISENTO";
  amount?:         number;           // calculado pelo motor
  discount?:       number;
  iva?:            number;
  totalAmount?:    number;
  paymentMethod?:  string;
  operationRef?:   string;
  receiptUrl?:     string;
  amountPaid?:     number;
  paidDate?:       string;
  selectedLeadId?: string;           // RoomBookingLead para marcar como convertido
}
```
**Resposta:** `{ reservation, payment?, invoice?, noteNumber? }` · HTTP 201  
**Correcções aplicadas (VOL04-1):**
- `recordFinancialHistory` movido para após `await prisma.$transaction()` (DT-017 ✅)
- Conflict check dentro de `$transaction(Serializable)` (DT-013 ✅)
- State machine: `assertValidTransition()` antes de qualquer escrita
- Validação de `startDatetime < endDatetime`

---

### `GET /api/reservations/[id]`
**Estado:** ✅  
**Auth:** ADMIN | COMERCIAL | FINANCEIRO  
**Resposta:** `{ reservation, invoice?, payments[], liquidationNotes[] }`

---

### `PATCH /api/reservations/[id]`
**Estado:** ✅ Hardened (VOL04-1 — 29 Jul 2026)  
**Auth:** ADMIN | COMERCIAL  
**Body:** campos opcionais (eventName, status, paymentStatus, horários, etc.)  
**Correcções aplicadas (VOL04-1):**
- Quando `startDatetime` ou `endDatetime` mudam: conflict check DENTRO de `$transaction(Serializable)` (DT-013 ✅)
- Transições de `status` validadas via `assertValidTransition()` da state machine
- Retorna `refundable: boolean` quando `status → CANCELADA` (via `isCancellationFree()`)
- `cancellationReason` aceite no body

---

### `DELETE /api/reservations/[id]`
**Estado:** ✅  
**Auth:** ADMIN  
**Comportamento:** Soft-cancel (status → CANCELADA); não apaga dados  
**Publicação:** `reservation.cancelled`

---

### `POST /api/reservations/[id]/receive-payment`
**Estado:** ✅  
**Auth:** ADMIN | FINANCEIRO  
**Body:** `{ paymentMethod, operationRef?, receiptUrl?, paidDate?, amount }`  
**Resposta:** `{ ok, payment, invoice, reservation }`

---

### `GET /api/reservations/availability`
**Estado:** ✅ Implementado (VOL04-2A — 29 Jul 2026)  
**Auth:** ADMIN | COMERCIAL | FINANCEIRO  
**Query:** `date: YYYY-MM-DD` (obrigatório), `planId?`  
**Resposta:**
```typescript
{
  date: string;
  plans: Array<{
    id:          string;
    name:        string;
    maxPeople:   number;
    openTime:    string;    // de RoomSettings
    closeTime:   string;
    bookedSlots: Array<{
      from:    string;      // ISO
      to:      string;
      status:  string;
      // admin vê eventName; portal não vê
      eventName?: string;
    }>;
    freeSlots: Array<{
      from: string;
      to:   string;
    }>;
  }>;
}
```
**Diferença do portal:** admin vê `eventName` nos slots ocupados; portal não vê.

---

## API de Planos (MeetingPlan)

### `GET /api/plans`
**Estado:** ✅  
**Auth:** ADMIN | COMERCIAL | FINANCEIRO  
**Resposta:** `{ plans[] }` (apenas activos)

### `POST /api/plans`
**Estado:** ✅ Hardened (VOL04-3A — 29 Jul 2026)  
**Auth:** ADMIN  
**Body:**
```typescript
{
  name:                 string;     // obrigatório
  maxPeople:            number;     // obrigatório, > 0
  description?:         string;
  coffeeBreakAvailable?:boolean;
  customPricingAllowed?:boolean;
  minHoursForCustom?:   number;     // default 16
  pricePerHour?:        number;     // >= 0
  coffeeBreakPrice?:    number;     // >= 0
  halfDayPrice?:        number;     // >= 0
  fullDayPrice?:        number;     // >= 0
  weekendPrice?:        number;     // >= 0
  promoPrice?:          number;     // >= 0
}
```
**Correcção VOL04-3:** Adicionar Zod com `.nonnegative()` em todos os preços.

### `GET /api/plans/[id]`
**Estado:** ✅

### `PATCH /api/plans/[id]`
**Estado:** ✅ Hardened (VOL04-3A — 29 Jul 2026)  
**Auth:** ADMIN  
**Correcções:** validação de preços · 404 explícito · verificação de reservas futuras antes de desactivar.

### `DELETE /api/plans/[id]`
**Estado:** ✅ Hardened (VOL04-3A — 29 Jul 2026)  
**Auth:** ADMIN  
**Comportamento:** Soft-delete (`active: false`); verifica reservas futuras antes (409 se existirem).

---

## API de Configurações

### `GET /api/admin/room-settings`
**Estado:** ✅  
**Auth:** ADMIN

### `PUT /api/admin/room-settings`
**Estado:** ✅ Hardened (VOL04-3B — 29 Jul 2026)  
**Auth:** ADMIN  
**Validações:** `openTime < closeTime` · `minHours ≥ 1` · `maxHours > minHours` · `maxDiscount ∈ [0,100]`.

---

## API de Pricing (RoomPricing — LEGADO)

### `GET /api/admin/room-pricing`
**Estado:** ✅ (mantido para UI legacy)

### `POST /api/admin/room-pricing`
**Estado:** ✅ (mantido para UI legacy)

### `PUT /api/admin/room-pricing` (bulk-upsert)
**Estado:** ✅ (mantido para UI legacy)

### `PATCH /api/admin/room-pricing/[id]`
**Estado:** ✅ (mantido para UI legacy)

### `DELETE /api/admin/room-pricing/[id]`
**Estado:** ✅ (mantido para UI legacy)

**Nota VOL04:** RoomPricing permanece operacional mas não é usado na lógica de cálculo
nova. MeetingPlan é a fonte de preços canónica. Documentar claramente no código.

---

## API de Leads (RoomBookingLead)

### `POST /api/room-booking-leads`
**Estado:** ✅ (público — landing page)  
**Auth:** Pública (rate limiting via IP)

### `GET /api/room-booking-leads` (via admin)
**Estado:** ✅  
**Auth:** ADMIN | COMERCIAL

### `PATCH /api/room-booking-leads/[id]`
**Estado:** ✅  
**Auth:** ADMIN | COMERCIAL

### `DELETE /api/room-booking-leads/[id]`
**Estado:** ✅  
**Auth:** ADMIN

### `POST /api/room-booking-leads/[id]/to-reservation`
**Estado:** 🔧 (conversão sem $transaction garantida)  
**Auth:** ADMIN | COMERCIAL  
**Correcção VOL04-2:** Garantir que a criação da reserva e o update do lead ocorrem na mesma `$transaction`.

### `POST /api/room-booking-leads/[id]/convert`
**Estado:** ✅ (alternativo ao acima — verificar se é redundante)  
**Nota VOL04-1:** Avaliar se deve ser consolidado com `to-reservation`.

---

## API de Relatórios

### `GET /api/salas/reports`
**Estado:** ✅  
**Auth:** ADMIN | FINANCEIRO  
**Query:** `from`, `to`, `planId`  
**Resposta:** `{ summary, byMonth[], byPlan[], byPaymentStatus, topClients[], plans[] }`  

### `GET /api/salas/reports/export` 🆕
**Estado:** 🆕  
**Auth:** ADMIN | FINANCEIRO  
**Query:** `from`, `to`, `format: "xlsx" | "csv"`  
**Comportamento:** Exportar dados do relatório como XLSX ou CSV via erp-export-service  
**Sprint:** VOL04-4

---

## API Cron (nova)

### `POST /api/cron/reservations-close`
**Estado:** ✅ Implementado (VOL04-2B — 29 Jul 2026)  
**Auth:** Bearer `CRON_SECRET`  
**Comportamento:**
1. `updateMany`: CONFIRMADA → CONCLUIDA onde `endDatetime < now`
2. Publicar `reservation.completed` para cada reserva concluída
3. Retornar `{ closed: number, errors: number }`

**Cron schedule:** `0 3 * * *` (03:00 WAT diariamente)

---

## Rotas Legacy (deprecated)

| Rota | Estado | Substituída por |
|---|---|---|
| `GET /api/rooms` | ⚠️ Retorna `[]` vazio | `/api/plans` |
| `POST /api/rooms` | ⚠️ Retorna 410 | `/api/plans` |
| `GET /api/rooms/[id]/reservations` | ⚠️ Retorna 404 | `/api/reservations?planId=...` |

**Nota VOL04:** manter as rotas legacy com resposta de redirecionamento durante VOL04.
Remoção planeada para Fase P0 review.

---

*VD Platform — Volume 04 — api.md — 29 Julho 2026*  
*Especificação aguarda aprovação formal do Product Owner*
