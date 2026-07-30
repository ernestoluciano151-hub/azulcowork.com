# Modelo de Dados — Reservas

> **Volume:** 04  
> **Estado:** 📋 Especificação — Aguarda aprovação PO  
> **Data:** 29 Julho 2026

---

## Visão Geral

O módulo de Reservas usa 5 modelos no schema Prisma. **Nenhum modelo novo é necessário em VOL04** — todas as melhorias são ao nível de lógica de negócio e APIs.

---

## 1. MeetingPlan — Plano de Sala

**Fonte de preços canónica (SSoT de pricing).**

```prisma
model MeetingPlan {
  id                    String        @id @default(cuid())
  name                  String        // "Pacote Horário", "Pacote Meio Período", etc.
  maxPeople             Int           // capacidade máxima
  description           String?
  coffeeBreakAvailable  Boolean       @default(true)
  customPricingAllowed  Boolean       @default(false)
  minHoursForCustom     Int?          @default(16)

  // Preços (em Kz — AOA)
  pricePerHour          Float         @default(0)   // preço base por hora
  coffeeBreakPrice      Float         @default(0)   // adicional por coffee break
  halfDayPrice          Float         @default(0)   // preço fixo 4h
  fullDayPrice          Float         @default(0)   // preço fixo 8h
  weekendPrice          Float         @default(0)   // preço fim-de-semana (fixo)
  promoPrice            Float         @default(0)   // preço promocional

  active                Boolean       @default(true)
  reservations          Reservation[]
  createdAt             DateTime      @default(now())
}
```

**Regra de precedência de preços:**
```
1. weekendPrice (se fim-de-semana e weekendPrice > 0)
2. fullDayPrice (se totalHours >= 8 e fullDayPrice > 0)
3. halfDayPrice (se totalHours >= 4 e halfDayPrice > 0)
4. pricePerHour × totalHours (default)
5. + coffeeBreakPrice (se coffeeBreak = true)
```

---

## 2. Reservation — Reserva

**Entidade central do módulo.**

```prisma
model Reservation {
  id                String      @id @default(cuid())
  reservationNumber String?     // RES-YYYY-NNNNNN — imutável após criação

  // Cliente
  eventName         String      // nome do evento/reunião
  companyName       String?     // cliente externo (free-text)
  companyId         String?     // cliente coworking (FK → Company)
  company           Company?    @relation(...)
  responsible       String      // nome do responsável
  email             String?
  whatsapp          String?

  // Plano e horário
  planId            String
  plan              MeetingPlan @relation(...)
  participants      Int
  startDatetime     DateTime
  endDatetime       DateTime
  totalHours        Float
  coffeeBreak       Boolean     @default(false)
  observations      String?

  // Estado
  status            String      @default("CONFIRMADA")
  // CONFIRMADA | RESERVADO | PENDENTE_APROVACAO | CANCELADA | CONCLUIDA
  isCustomPricing   Boolean     @default(false)
  customRequest     String?

  // Financeiro
  paymentOption     String      @default("PAGAR_NO_DIA")
  // PAGAR_AGORA | PAGAR_NO_DIA | FACTURAR | ISENTO
  amount            Float       @default(0)   // base (sem desconto, sem IVA)
  discount          Float       @default(0)   // desconto em valor (Kz)
  iva               Float       @default(0)   // IVA % (ex: 14)
  totalAmount       Float       @default(0)   // (amount - discount) * (1 + iva/100)
  paymentStatus     String      @default("PENDENTE")
  // PAGO | PENDENTE | FACTURADO | ISENTO | PARCIAL
  paymentMethod     String?
  operationRef      String?
  receiptUrl        String?
  financialNotes    String?
  amountPaid        Float       @default(0)
  paidDate          DateTime?

  // Links financeiros
  paymentId         String?     // Payment.id
  invoiceId         String?     // Invoice.id
  roomBookingLeadId String?     // RoomBookingLead.id

  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([planId])
  @@index([companyId])
  @@index([startDatetime])
  @@index([status])
  @@index([paymentStatus])
  @@index([reservationNumber])
}
```

### Índices adicionais propostos para VOL04

```prisma
// Para conflict check (query crítica — usada em toda criação/edição)
@@index([status, startDatetime, endDatetime])
// Para cron de auto-conclusão
@@index([status, endDatetime])
// Para listagem por empresa com filtro de data
@@index([companyId, startDatetime])
```

**Nota:** estes índices devem ser avaliados com `EXPLAIN ANALYZE` em produção
antes de adicionar — podem ou não ser necessários dado o volume actual de dados.
Propostos para VOL04-1 como melhoria opcional.

---

## 3. RoomBookingLead — Lead da Landing Page

```prisma
model RoomBookingLead {
  id              String    @id @default(cuid())
  firstName       String
  lastName        String
  company         String?
  email           String
  whatsapp        String
  planName        String    // nome do plano escolhido (texto livre)
  participants    Int?
  preferredDate   DateTime?
  preferredTime   String?
  observations    String?
  coffeeBreak     Boolean   @default(false)
  status          String    @default("NOVO")
  // NOVO | EM_CONTACTO | RESERVA_CRIADA | CANCELADO | SEM_RESPOSTA
  source          String    @default("landing-sala")
  ip              String?
  companyId       String?   // link para Company se identificado
  companyRef      Company?  @relation(...)
  reservationId   String?   // link para Reservation após conversão
  convertedAt     DateTime?
  convertedBy     String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([status])
  @@index([createdAt])
  @@index([planName])
  @@index([companyId])
}
```

**Pipeline de conversão:**
```
NOVO → EM_CONTACTO → RESERVA_CRIADA (sucesso)
NOVO → EM_CONTACTO → CANCELADO (não avança)
NOVO → SEM_RESPOSTA (sem contacto em 48h)
```

---

## 4. RoomSettings — Configurações Globais

```prisma
model RoomSettings {
  id                  String   @id @default(cuid())
  defaultPricePerHour Float    @default(15000)   // Kz
  defaultHalfDay      Float    @default(50000)
  defaultFullDay      Float    @default(90000)
  defaultWeekend      Float    @default(120000)
  defaultIva          Float    @default(0)        // %
  maxDiscount         Float    @default(100)      // % máximo para COMERCIAL
  currency            String   @default("AOA")
  openTime            String   @default("08:00")  // "HH:MM"
  closeTime           String   @default("18:00")
  minHours            Float    @default(1)
  maxHours            Float    @default(12)
  updatedAt           DateTime @updatedAt
  updatedBy           String?
}
```

**Singleton:** apenas 1 registo (`id = "default"`). API cria automaticamente se não existir.

---

## 5. RoomPricing — Preços por Tier (LEGADO)

```prisma
model RoomPricing {
  id              String   @id @default(cuid())
  roomId          String   @default("sala-reuniao")
  label           String   // "1 Hora", "Meio Período", "Dia Inteiro"
  durationMinutes Int      // 60, 240, 480
  price           Float    // Kz
  currency        String   @default("AOA")
  active          Boolean  @default(true)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([roomId])
  @@index([durationMinutes])
  @@index([active])
}
```

**Estado:** LEGADO. Mantido para compatibilidade com UI existente mas **não usado**
na lógica de cálculo de preços. MeetingPlan é a fonte canónica.
A UI de gestão de pricing (`/admin/room-pricing`) continua a funcionar mas deve
mostrar aviso: "Os preços configurados aqui não afectam os cálculos automáticos.
Use os Planos de Sala para gerir preços."

---

## Relações entre Entidades

```
Reservation ──── MeetingPlan    (N:1 — cada reserva tem 1 plano)
Reservation ──── Company        (N:0-1 — opcional; só clientes coworking)
Reservation ──── Payment        (1:0-1 — ligação ao Payment criado)
Reservation ──── Invoice        (1:0-1 — ligação à Invoice criada)
RoomBookingLead ── Company      (N:0-1 — opcional)
RoomBookingLead ── Reservation  (1:0-1 — após conversão)
```

---

## Documentos Financeiros Gerados por Reserva

| Cenário (paymentOption) | Documentos criados |
|---|---|
| `PAGAR_AGORA` | Payment · Invoice (FT-SALA) · LiquidationNote · Receipt (REC) |
| `PAGAR_NO_DIA` | Payment (PENDENTE) — sem invoice até receber |
| `FACTURAR` | Invoice (FT-SALA, status PENDENTE) |
| `ISENTO` | Nenhum documento financeiro |

---

*VD Platform — Volume 04 — data-model.md — 29 Julho 2026*  
*Especificação aguarda aprovação formal do Product Owner*
