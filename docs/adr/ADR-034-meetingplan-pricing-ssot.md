# ADR-034 — MeetingPlan como SSoT de Preços; RoomPricing como Legado

**Estado:** ACEITE  
**Data:** 2026-07-29  
**Decisores:** Ernesto Pinto Luciano  
**Volume:** VOL04 — Reservas  
**Implementado em:** `src/lib/pricing-service.ts` · `src/app/api/plans/route.ts` · `src/app/api/plans/[id]/route.ts`

---

## Contexto

O módulo de Reservas tinha **dois sistemas de preços paralelos e sem hierarquia definida**:

1. **`MeetingPlan`** — tabela com preços directamente no modelo do plano:
   - `pricePerHour`, `halfDayPrice`, `fullDayPrice`, `weekendPrice`, `coffeeBreakPrice`, `promoPrice`

2. **`RoomPricing`** — tabela separada com preços por tier/intervalo:
   - `planId`, `tierId`, `pricePerHour`, `halfDayPrice`, `fullDayPrice`, `weekendPrice`

O `pricing-service.ts` (`calcPrice`) recebia um `plan` de tipo `MeetingPlan` e calculava preços a partir dos seus campos. O `RoomPricing` existia mas não estava integrado na lógica de cálculo actual.

Esta ambiguidade violava o princípio SSoT: havia dois proprietários para o mesmo dado (o preço de uma reserva).

---

## Decisão

**`MeetingPlan` é declarado o Single Source of Truth para todos os preços de reserva.**  
**`RoomPricing` é marcado como LEGADO: mantido no schema (sem remoção) mas não utilizado em lógica nova.**

### Hierarquia de preços em `calcPrice` (MeetingPlan):

```
1. isWeekend=true AND weekendPrice > 0           → priceMode = "weekend"
2. totalHours ≥ 6 (fullDay) AND fullDayPrice > 0  → priceMode = "fullDay"
3. totalHours ≥ 3 AND halfDayPrice < hourly cost  → priceMode = "halfDay"
4. (default)                                       → priceMode = "hourly"
```

### Regra para `RoomPricing`:
- O schema permanece intacto (sem DROP TABLE)
- Nenhum novo endpoint escreve em `RoomPricing`
- Nenhuma lógica de pricing lê de `RoomPricing`
- A API `/api/admin/room-pricing/*` pode continuar a existir para compatibilidade mas não afecta cálculos
- Documentação marca explicitamente `RoomPricing` como `[LEGADO]`

---

## Alternativas Consideradas

### A. Usar RoomPricing como SSoT (migrar calcPrice)
Reestruturar `calcPrice` para ler de `RoomPricing` via query por `planId + tier`.

**Rejeitada:** `RoomPricing` não tem campos para `coffeeBreakPrice`, `promoPrice`, nem a lógica de `weekendPrice` por plano. Requeria migração de schema sem benefício claro. `MeetingPlan` já tem todos os campos necessários.

### B. Mesclar os dois sistemas (RoomPricing override MeetingPlan)
Se existir `RoomPricing` para o plano, usa-o; caso contrário, usa `MeetingPlan`.

**Rejeitada:** lógica de fallback complexa e opaca. Violariam SSoT. Difícil de testar e de raciocinar.

### C. Remover RoomPricing do schema agora
Drop table + migração Prisma.

**Rejeitada:** risco de regressão em funcionalidade existente desconhecida; possibilidade de dados históricos relevantes. A remoção fica para VOL05+ após auditoria completa de uso.

---

## Consequências

### Positivas
- SSoT claro: um plano tem um preço, definido no `MeetingPlan`
- `calcPrice` é 100% puro (recebe plan, retorna resultado) — fácil de testar (37 casos de teste)
- Nenhuma query adicional necessária para obter preços (já incluído no join de `Reservation → MeetingPlan`)
- Administração de preços simplificada: editar o plano, ver preços actualizados imediatamente

### Negativas
- `RoomPricing` persiste no schema como legado — potencial confusão para futuros developers
- Clientes que acediam a `RoomPricing` via API mantêm acesso mas sem efeito nos cálculos

### Documentação de legado
O comentário no schema Prisma deve marcar:
```
// [LEGADO] — não usado em lógica nova. Ver ADR-034. Remover em VOL05+.
model RoomPricing { ... }
```

---

## Revisão

Rever em VOL05 para avaliar remoção definitiva de `RoomPricing`. Pré-condição: confirmar que nenhum relatório histórico ou export depende de `RoomPricing`.

---

*VD Platform — ADR-034 — 29 Julho 2026*
