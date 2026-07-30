# Estratégia de Testes — Reservas

> **Volume:** 04  
> **Estado:** ✅ Implementado — VOL04-4 e VOL04-5 concluídos (29 Jul 2026)  
> **Data:** 29 Julho 2026

---

## Objectivos

```
□ Cobertura ≥ 60% no módulo de reservas
□ State machine: 100% das transições cobertas (válidas + inválidas)
□ Conflict check: todos os cenários de sobreposição testados
□ Motor de preços: todos os ramos de cálculo cobertos
□ Política de cancelamento: regra de 24h testada
□ Ciclo completo (integração): lead → reserva → pagamento → conclusão
```

---

## Ficheiros de Testes

```
src/__tests__/unit/
  reservation-state-machine.test.ts    — state machine + transições
  reservation-conflict.test.ts         — fórmula de sobreposição + casos limite
  reservation-pricing.test.ts          — motor de preços + desconto + IVA
  reservation-cancellation.test.ts     — política de cancelamento 24h
  reservation-validators.test.ts       — Zod schemas (VOL04-1)

src/__tests__/integration/
  reservation-cycle.integration.test.ts — ciclo completo
```

---

## VOL04-4 — Testes Unitários

### 1. State Machine (`reservation-state-machine.test.ts`)

```typescript
describe("VOL04 — State Machine: transições válidas", () => {
  it("PENDENTE_APROVACAO → CONFIRMADA (aprovação)")
  it("PENDENTE_APROVACAO → CANCELADA (rejeição)")
  it("RESERVADO → CONFIRMADA (pagamento recebido)")
  it("RESERVADO → CANCELADA (cliente cancela)")
  it("CONFIRMADA → CONCLUIDA (evento ocorreu)")
  it("CONFIRMADA → CANCELADA (dentro da política)")
});

describe("VOL04 — State Machine: transições inválidas", () => {
  it("CONCLUIDA → qualquer estado → false")
  it("CANCELADA → qualquer estado → false")
  it("PENDENTE_APROVACAO → CONCLUIDA → false")
  it("RESERVADO → CONCLUIDA → false")
  it("CONFIRMADA → PENDENTE_APROVACAO → false")
  it("CONFIRMADA → RESERVADO → false")
});

describe("VOL04 — State Machine: estados terminais", () => {
  it("CONCLUIDA tem 0 transições válidas")
  it("CANCELADA tem 0 transições válidas")
});
```

**Estimativa:** 14 casos · todos via helpers inline (sem Prisma)

---

### 2. Conflict Check (`reservation-conflict.test.ts`)

```typescript
// Fórmula: existStart < newEnd && existEnd > newStart

describe("VOL04 — Conflict Check: sobreposições", () => {
  it("slots idênticos → conflito")
  it("novo começa no meio do existente → conflito")
  it("novo termina no meio do existente → conflito")
  it("existente dentro do novo → conflito")
  it("novo dentro do existente → conflito")
});

describe("VOL04 — Conflict Check: sem conflito", () => {
  it("adjacente (existEnd === newStart) → sem conflito")
  it("adjacente (newEnd === existStart) → sem conflito")
  it("totalmente antes → sem conflito")
  it("totalmente depois → sem conflito")
});

describe("VOL04 — Conflict Check: estados que bloqueiam", () => {
  it("CONFIRMADA bloqueia slot")
  it("RESERVADO bloqueia slot")
  it("PENDENTE_APROVACAO bloqueia slot")
  it("CANCELADA NÃO bloqueia slot")
  it("CONCLUIDA NÃO bloqueia slot (passado)")
});
```

**Estimativa:** 14 casos · fórmula pura sem Prisma

---

### 3. Motor de Preços (`reservation-pricing.test.ts`)

```typescript
describe("VOL04 — Pricing: ramos de cálculo", () => {
  it("fim-de-semana com weekendPrice → usa weekendPrice")
  it("8h com fullDayPrice → usa fullDayPrice")
  it("4h com halfDayPrice → usa halfDayPrice")
  it("2h → pricePerHour × 2")
  it("coffee break = true → adiciona coffeeBreakPrice")
  it("coffee break = false → não adiciona")
});

describe("VOL04 — Pricing: desconto + IVA", () => {
  it("sem desconto sem IVA → totalAmount = amount")
  it("desconto 10% → totalAmount correcto")
  it("IVA 14% → totalAmount correcto")
  it("desconto + IVA combinados → ordem: (amount - discount) * (1 + iva/100)")
  it("desconto > amount → totalAmount = 0 (mínimo)")
});

describe("VOL04 — Pricing: precedência de planos", () => {
  it("weekendPrice > fullDayPrice (precedência correcta)")
  it("fullDayPrice > halfDayPrice (precedência correcta)")
  it("halfDayPrice > pricePerHour × totalHours (precedência correcta)")
  it("promoPrice = 0 → ignorado")
});
```

**Estimativa:** 13 casos

---

### 4. Política de Cancelamento (`reservation-cancellation.test.ts`)

```typescript
describe("VOL04 — Cancelamento: regra de 24h", () => {
  it("48h antes → isCancellationFree = true")
  it("24h exactas → isCancellationFree = true")
  it("23h59m antes → isCancellationFree = false")
  it("1h antes → isCancellationFree = false")
  it("evento passado → isCancellationFree = false")
});

describe("VOL04 — Cancelamento: CANCELLATION_FREE_HOURS constante", () => {
  it("CANCELLATION_FREE_HOURS = 24")
});
```

**Estimativa:** 6 casos

---

## VOL04-5 — Testes de Integração

### Ciclo Completo (`reservation-cycle.integration.test.ts`)

```typescript
describe("VOL04 — Ciclo: lead → reserva → pagamento", () => {
  it("conflito: dois slots sobrepostos → 409 no segundo")
  it("slots adjacentes: ambos criados sem conflito")
  it("paymentOption=PAGAR_AGORA → cria Payment + Invoice + LiquidationNote")
  it("paymentOption=PAGAR_NO_DIA → cria Payment PENDENTE; sem Invoice")
  it("paymentOption=FACTURAR → cria Invoice PENDENTE; sem Payment")
  it("paymentOption=ISENTO → sem documentos financeiros")
  it("receive-payment → payment PAGO + invoice LIQUIDADA")
  it("reservationNumber é único e imutável")
  it("PATCH horário sobreposição → 409")
  it("PATCH horário adjacente → 200 sem conflito")
});

describe("VOL04 — Ciclo: state machine via PATCH", () => {
  it("PENDENTE_APROVACAO → CONFIRMADA → 200")
  it("PENDENTE_APROVACAO → RESERVADO → 422 (transição inválida)")
  it("CONCLUIDA → CANCELADA → 422 (estado terminal)")
  it("CANCELADA → CONFIRMADA → 422 (estado terminal)")
});

describe("VOL04 — Ciclo: auto-conclusão (cron)", () => {
  it("CONFIRMADA após endDatetime → CONCLUIDA pelo cron")
  it("RESERVADO após endDatetime → não alterado (só CONFIRMADA)")
  it("CANCELADA após endDatetime → não alterado")
});

describe("VOL04 — Ciclo: política de cancelamento", () => {
  it("cancelar com 48h de antecedência → refundable=true")
  it("cancelar com 1h de antecedência → refundable=false")
  it("reserva de empresa (companyId) → cria TimelineEntry")
  it("reserva externa (sem companyId) → sem TimelineEntry")
});
```

**Estimativa:** 18 casos

---

## Resumo

| Ficheiro | Casos | Sprint |
|---|---|---|
| reservation-state-machine.test.ts | 14 | VOL04-4 |
| reservation-conflict.test.ts | 14 | VOL04-4 |
| reservation-pricing.test.ts | 13 | VOL04-4 |
| reservation-cancellation.test.ts | 6 | VOL04-4 |
| reservation-cycle.integration.test.ts | 18 | VOL04-5 |
| **Total** | **65** | |

Validação via `node -e` para lógica pura antes de escrever os testes Vitest formais.

---

*VD Platform — Volume 04 — testing.md — 29 Julho 2026*  
*Especificação aguarda aprovação formal do Product Owner*
