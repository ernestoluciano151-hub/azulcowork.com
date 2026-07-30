# Arquitectura de Sistema — VD Platform

> **Documento:** 00-ARCH-001  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado  
> **Versão:** 1.0.0  
> **Data:** Julho 2026  

---

## 1. Visão Geral da Arquitectura

O VD Platform adopta uma arquitectura em camadas baseada nos princípios de **Clean Architecture** (Robert C. Martin) adaptada ao contexto de uma aplicação Next.js 15 com Prisma e PostgreSQL. A arquitectura é complementada por **Domain-Driven Design (DDD)** para organização do domínio e **Event-Driven Architecture** para comunicação entre módulos.

### 1.1 Diagrama de Arquitectura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CAMADA DE APRESENTAÇÃO                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Landing Page   │  │   Admin Panel    │  │  Portal Cliente  │  │
│  │   (Next.js RSC)  │  │   (Next.js RSC)  │  │  (Next.js RSC)   │  │
│  │   /salas         │  │   /admin/*       │  │  /portal/* (v2)  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└───────────┼─────────────────────┼─────────────────────┼────────────┘
            │                     │                     │
┌───────────▼─────────────────────▼─────────────────────▼────────────┐
│                    CAMADA DE API (Next.js Route Handlers)           │
│   /api/leads/*   /api/companies/*   /api/reservations/*            │
│   /api/payments/*   /api/invoices/*   /api/rooms/*                 │
│   /api/auth/*   /api/notifications/*   /api/search/*               │
│                                                                     │
│   ► Validação de input (validators.ts)                              │
│   ► Autenticação/Autorização (middleware.ts + auth.ts)              │
│   ► Rate Limiting (rateLimit.ts)                                    │
│   ► Serialização/Deserialização                                     │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                    CAMADA DE APLICAÇÃO (Application Layer)          │
│                                                                     │
│   ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│   │ FinanceService │  │ PricingService │  │  NotificationSvc   │   │
│   │ (finance-      │  │ (pricing-      │  │  (notifications.ts)│   │
│   │  service.ts)   │  │  service.ts)   │  │                    │   │
│   └────────┬───────┘  └────────┬───────┘  └────────────────────┘   │
│            │                   │                                    │
│   ┌────────▼───────────────────▼──────────────────────────────┐    │
│   │                    EVENT BUS                               │    │
│   │              (event-bus.ts / publish / subscribe)          │    │
│   │   lead.created → notification.created → email.sent ...     │    │
│   └───────────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                    CAMADA DE DOMÍNIO (Domain Layer)                 │
│                                                                     │
│   Entidades: Lead, Company, Reservation, Payment, Invoice, ...      │
│   Value Objects: Money, DateRange, ContactInfo, ...                 │
│   Domain Events: LeadCreated, PaymentReceived, ContractExpiring ... │
│   Business Rules: definidas na Business Bible                       │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│              CAMADA DE INFRAESTRUTURA (Infrastructure Layer)        │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│   │   Prisma ORM │  │  Cloudinary  │  │     Nodemailer (SMTP)    │  │
│   │  (prisma.ts) │  │  (upload)    │  │     (email.ts)           │  │
│   └──────┬───────┘  └──────────────┘  └──────────────────────────┘  │
│          │                                                          │
│   ┌──────▼───────────────────────────────────────────────────────┐  │
│   │              PostgreSQL (Supabase / Neon)                    │  │
│   │   Database: leadgen_crm                                      │  │
│   └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Clean Architecture

### 2.1 Princípio Fundamental

> *As camadas internas (Domínio, Aplicação) não conhecem as camadas externas (Infraestrutura, Apresentação). As dependências apontam sempre para dentro.*

```
                    ┌─────────────────┐
                    │  Apresentação   │  ← Next.js Pages / Components
                    └────────┬────────┘
                             │ depende de
                    ┌────────▼────────┐
                    │   API Layer     │  ← Route Handlers
                    └────────┬────────┘
                             │ depende de
                    ┌────────▼────────┐
                    │   Aplicação     │  ← Services, Use Cases
                    └────────┬────────┘
                             │ depende de
                    ┌────────▼────────┐
                    │    Domínio      │  ← Entidades, Regras, Events
                    └─────────────────┘
                             ▲
                    ┌────────┴────────┐
                    │ Infraestrutura  │  ← Prisma, Cloudinary, Email
                    └─────────────────┘
```

**Regra de dependência:** `Infraestrutura → Domínio ← Aplicação ← API ← Apresentação`

### 2.2 Responsabilidades por Camada

#### Camada de Domínio
- Define **o que** o negócio faz (entidades, regras, invariantes)
- Não conhece nada de Next.js, Prisma, HTTP ou base de dados
- Contém os tipos TypeScript centrais e as regras de negócio puras
- **Ficheiros actuais:** `src/types/`, regras nas Business Bible docs

#### Camada de Aplicação
- Orquestra o **como** (use cases, services)
- Chama repositórios (via Prisma), publica eventos, coordena transacções
- **Ficheiros actuais:** `src/lib/finance-service.ts`, `src/lib/pricing-service.ts`, `src/lib/finance.ts`, `src/lib/timeline.ts`

#### Camada de API
- Traduz pedidos HTTP em chamadas à Aplicação
- Valida input, verifica autenticação/autorização, serializa resposta
- **Ficheiros actuais:** `src/app/api/**/*.ts`

#### Camada de Apresentação
- Renderiza UI; pode chamar directamente a base de dados em Server Components (padrão Next.js)
- Não contém lógica de negócio
- **Ficheiros actuais:** `src/app/admin/**/*.tsx`, `src/components/**/*.tsx`

#### Camada de Infraestrutura
- Implementações concretas: Prisma, Cloudinary, Nodemailer
- **Ficheiros actuais:** `src/lib/prisma.ts`, `src/lib/email.ts`

---

## 3. Domain-Driven Design (DDD)

### 3.1 Bounded Contexts

O sistema é dividido em **Bounded Contexts** — regiões do domínio com linguagem ubíqua própria e fronteiras bem definidas. A comunicação entre contextos é feita **exclusivamente via eventos**.

```
┌──────────────────┐     eventos      ┌──────────────────┐
│   CRM Context    │ ─────────────► │  Cowork Context  │
│                  │ ◄───────────── │                  │
│  Lead            │                │  Company         │
│  Note            │                │  Employee        │
│  Pipeline Stage  │                │  Contract        │
└──────────────────┘                └────────┬─────────┘
         │                                   │
     eventos                             eventos
         │                                   │
         ▼                                   ▼
┌──────────────────┐                ┌──────────────────┐
│Financial Context │                │Reservation Ctx   │
│                  │                │                  │
│  Invoice         │                │  Reservation     │
│  Payment         │ ◄── eventos ── │  MeetingPlan     │
│  LiquidationNote │                │  RoomBookingLead │
│  FinancialAudit  │                │  RoomSettings    │
│  Expense         │                │  RoomPricing     │
└──────────────────┘                └──────────────────┘
         │                                   │
     eventos                             eventos
         │                                   │
         ▼                                   ▼
┌──────────────────┐                ┌──────────────────┐
│Security Context  │                │  Comm. Context   │
│                  │                │                  │
│  AdminUser       │                │  Notification    │
│  DeleteRequest   │                │  Email           │
│  Session         │                │  WhatsApp        │
│  RBAC            │                │  Campaign        │
└──────────────────┘                └──────────────────┘
```

### 3.2 Aggregate Roots

Cada Bounded Context tem um **Aggregate Root** — a entidade principal que controla o acesso a todas as outras entidades do seu contexto.

| Context | Aggregate Root | Entidades Dependentes |
|---|---|---|
| CRM | `Lead` | `Note`, `Timeline` |
| Cowork | `Company` | `Employee`, `Timeline`, `LiquidationNote` |
| Financial | `Invoice` | `InvoicePayment`, `Payment`, `FinancialHistory`, `FinancialAudit` |
| Reservation | `Reservation` | `MeetingPlan`, `RoomPricing`, `RoomSettings` |
| Security | `AdminUser` | `DeleteRequest` |
| Communication | `Notification` | — |

### 3.3 Linguagem Ubíqua

A **Linguagem Ubíqua** é o vocabulário comum entre negócio e tecnologia. Termos definidos aqui devem ser usados consistentemente em código, documentação e conversas.

| Termo PT | Termo EN (código) | Contexto | Definição |
|---|---|---|---|
| Lead | Lead | CRM | Potencial cliente que ainda não converteu |
| Lead de Sala | RoomBookingLead | Reservas | Interesse em reservar sala de reunião |
| Empresa | Company | Cowork | Cliente activo com contrato vigente |
| Colaborador | Employee | Cowork | Funcionário de uma empresa cliente |
| Reserva | Reservation | Reservas | Utilização confirmada da sala de reunião |
| Plano de Reunião | MeetingPlan | Reservas | Tipo de reserva com preço e duração |
| Fatura | Invoice | Financeiro | Documento de cobrança emitido |
| Recibo | Payment (receiptNumber) | Financeiro | Confirmação de pagamento recebido |
| Nota de Liquidação | LiquidationNote | Financeiro | Documento que regista a quitação |
| Histórico Financeiro | FinancialHistory | Financeiro | Registo cronológico de movimentos |
| Auditoria Financeira | FinancialAudit | Financeiro | Log imutável de operações |
| Timeline | Timeline | Transversal | Historial de eventos por entidade |
| Notificação | Notification | Comunicação | Alerta interno no sistema |
| Solicitação de Eliminação | DeleteRequest | Segurança | Pedido formal de apagamento de dados |

---

## 4. Event-Driven Architecture

### 4.1 Princípio

> *Módulos comunicam através de eventos, nunca através de chamadas directas. Isto garante desacoplamento, rastreabilidade e extensibilidade.*

### 4.2 Arquitectura do Event Bus

O sistema implementa um **Event Bus em memória** (`src/lib/event-bus.ts`) com as seguintes características:

- **Tipo-safe:** TypeScript garante que cada evento tem o payload correcto
- **Assíncrono:** handlers são executados com `Promise.allSettled` para isolamento de erros
- **Singleton global:** garante instância única entre hot-reloads (Next.js dev)
- **Escalável:** a interface `publish/subscribe` é idêntica à de Redis Pub/Sub; migrar para Redis Upstash não altera o código cliente

### 4.3 Catálogo de Eventos

#### CRM
| Evento | Trigger | Handlers |
|---|---|---|
| `lead.created` | POST /api/leads | Notificação admin, Email ao lead (futuro) |
| `lead.updated` | PATCH /api/leads/[id] | Timeline, Auditoria |
| `lead.converted` | POST /api/leads/[id] (convert) | Criação de Company, Timeline |
| `lead.deleted` | DELETE /api/leads/[id] | Timeline, Auditoria |

#### Cowork
| Evento | Trigger | Handlers |
|---|---|---|
| `company.created` | POST /api/companies | Timeline, Notificação |
| `company.updated` | PATCH /api/companies/[id] | Timeline, Auditoria |
| `company.contractExpiringSoon` | Job periódico | Notificação admin, Email empresa |
| `company.contractExpired` | Job periódico | Notificação urgente, Mudança de status |

#### Financeiro
| Evento | Trigger | Handlers |
|---|---|---|
| `payment.received` | FinanceService.confirmPayment | Timeline, FinancialHistory, Auditoria, Email recibo |
| `payment.overdue` | Job periódico | Notificação admin, WhatsApp empresa |
| `invoice.created` | FinanceService | Timeline, Notificação |
| `invoice.paid` | FinanceService.confirmPayment | LiquidationNote, FinancialHistory |

#### Reservas
| Evento | Trigger | Handlers |
|---|---|---|
| `reservation.created` | POST /api/reservations | Email confirmação, Notificação admin |
| `reservation.confirmed` | PATCH /api/reservations/[id] | Email, WhatsApp, Timeline |
| `reservation.paymentReceived` | POST /api/reservations/[id]/receive-payment | FinanceService, Email |
| `reservation.cancelled` | PATCH /api/reservations/[id] | Email, Notificação |

### 4.4 Garantias do Event Bus

```
Publicador (ex: API Route)
    │
    ├── await publish("lead.created", { ... })
    │
    ▼
EventBus.emit()
    │
    ├── Handler 1: createNotification()     ← erro aqui não afecta handler 2
    ├── Handler 2: sendEmail()              ← erro aqui não afecta handler 3
    └── Handler 3: recordTimeline()         ← sempre executado
    
Promise.allSettled() → falhas são logadas, nunca propagadas ao publicador
```

**Limitação conhecida:** O Event Bus actual é **em memória** e não persiste eventos. Se o servidor reiniciar durante o processamento, eventos não processados são perdidos.

**Solução para produção:** Para múltiplas instâncias (Vercel Edge, Kubernetes), substituir por **Upstash Redis Pub/Sub** mantendo a mesma interface `publish/subscribe`. Esta migração não altera nenhum código cliente. Registada como ADR-003.

---

## 5. Repository Pattern e Service Layer

### 5.1 Padrão Actual

Actualmente, o acesso à base de dados é feito directamente via Prisma nas API Routes e nos Server Components. Isto é aceitável para o estado actual do projecto mas deve ser refactorado para um **Repository Pattern** explícito à medida que a complexidade cresce.

### 5.2 Repository Pattern (Target Architecture)

```typescript
// Exemplo de evolução futura

// Domínio — interface agnóstica de infraestrutura
interface LeadRepository {
  findById(id: string): Promise<Lead | null>;
  findByStatus(status: LeadStatus): Promise<Lead[]>;
  save(lead: Lead): Promise<Lead>;
  delete(id: string): Promise<void>;
}

// Infraestrutura — implementação Prisma
class PrismaLeadRepository implements LeadRepository {
  constructor(private prisma: PrismaClient) {}
  
  async findById(id: string) {
    return this.prisma.lead.findUnique({ where: { id } });
  }
  // ...
}
```

**Quando implementar:** Quando um módulo atingir complexidade que justifique testes unitários dos services sem base de dados real (mocking do repository).

### 5.3 Service Layer Actual

Os seguintes services já existem e seguem o padrão correcto:

| Service | Responsabilidade | Transacções |
|---|---|---|
| `FinanceService.confirmPayment` | Confirmação de pagamento de reserva (10 passos atómicos) | ✅ `$transaction` |
| `PricingService` | Cálculo de preços de reservas com regras complexas | ❌ (apenas cálculo) |
| `recordFinancialHistory` | Registo no histórico financeiro | ✅ Chamado dentro de transacção |
| `addTimeline` | Registo na timeline | ✅ Chamado dentro de transacção |
| `createNotification` | Criação de notificação interna | ❌ Sem transacção (tolerável) |

---

## 6. Autenticação e Autorização

### 6.1 Fluxo de Autenticação

```
Utilizador → POST /api/auth/login
    │
    ├── Validar email + password (bcryptjs.compare)
    ├── Verificar TOTP se activado (futuro — 2FA)
    ├── Gerar JWT com { sub, email, role, name }
    │   ├── Algoritmo: HS256
    │   ├── Expiração: 12h
    │   └── Secret: JWT_SECRET (env var)
    └── Set-Cookie: vd_admin_session (httpOnly, secure, sameSite=lax)

Cada request protegido → middleware.ts
    │
    ├── Extrair cookie vd_admin_session
    ├── jwtVerify() com secret
    ├── Verificar role para rotas admin-only
    └── NextResponse.next() ou redirect(/admin/login)
```

### 6.2 RBAC — Roles e Permissões

| Rota / Acção | ADMIN | COMERCIAL | FINANCEIRO | VIEWER |
|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| CRM — Leads (leitura) | ✅ | ✅ | ❌ | ✅ |
| CRM — Leads (escrita) | ✅ | ✅ | ❌ | ❌ |
| Empresas (leitura) | ✅ | ✅ | ✅ | ✅ |
| Empresas (escrita) | ✅ | ✅ | ❌ | ❌ |
| Financeiro (leitura) | ✅ | ❌ | ✅ | ❌ |
| Financeiro (escrita) | ✅ | ❌ | ✅ | ❌ |
| Reservas (leitura) | ✅ | ✅ | ✅ | ✅ |
| Reservas (escrita) | ✅ | ✅ | ❌ | ❌ |
| Configurações | ✅ | ❌ | ❌ | ❌ |
| Utilizadores | ✅ | ❌ | ❌ | ❌ |
| Delete Requests | ✅ | ❌ | ❌ | ❌ |
| Auditoria | ✅ | ❌ | ❌ | ❌ |

> **Regra de segurança:** Roles são verificados no middleware (Edge) e reavaliados nas API Routes antes de qualquer operação de escrita.

### 6.3 Security Headers

O `next.config.js` define headers de segurança para todos os pedidos:

| Header | Valor | Propósito |
|---|---|---|
| X-Frame-Options | SAMEORIGIN | Anti-clickjacking |
| X-Content-Type-Options | nosniff | Anti-MIME sniffing |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | Forçar HTTPS |
| Referrer-Policy | strict-origin-when-cross-origin | Privacidade |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | Minimizar superfície |
| Content-Security-Policy | (ver next.config.js) | Anti-XSS, anti-injection |

---

## 7. Padrões de Código Obrigatórios

### 7.1 Convenções TypeScript

```typescript
// ✅ CORRECTO — tipos explícitos em interfaces de serviço
export interface ConfirmPaymentInput {
  reservationId: string;
  amount: number;
  paymentMethod?: string | null;
}

// ✅ CORRECTO — tipos de retorno explícitos
export async function confirmPayment(
  prisma: PrismaClient,
  input: ConfirmPaymentInput
): Promise<ConfirmPaymentResult> { ... }

// ❌ ERRADO — any implícito
export async function confirmPayment(prisma: any, input: any) { ... }
```

### 7.2 Transacções Obrigatórias

Toda operação que modifica **mais de uma tabela** DEVE usar `prisma.$transaction()`:

```typescript
// ✅ CORRECTO — múltiplas escritas numa transacção atómica
return prisma.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({ ... });
  await tx.invoicePayment.create({ ... });
  await tx.invoice.update({ where: { id: invoice.id }, data: { ... } });
  await tx.reservation.update({ ... });
  // Ou tudo reverte automaticamente em caso de erro
});

// ❌ ERRADO — múltiplas escritas sem transacção
const invoice = await prisma.invoice.create({ ... });
await prisma.invoicePayment.create({ ... }); // pode falhar deixando invoice órfã
```

### 7.3 Publicação de Eventos

```typescript
// ✅ CORRECTO — publicar evento após operação principal
const lead = await prisma.lead.create({ data });
await publish("lead.created", {
  leadId: lead.id,
  firstName: lead.firstName,
  email: lead.email,
  source: lead.source ?? "landing-page",
});

// ❌ ERRADO — chamar directamente outro módulo
import { createNotification } from "@/lib/notifications-direct"; // acoplamento!
await createNotification({ ... });
```

### 7.4 Validação de Input

```typescript
// ✅ CORRECTO — validar sempre antes de persistir
import { validateLeadInput } from "@/lib/validators";

export async function POST(req: Request) {
  const body = await req.json();
  const validation = validateLeadInput(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.errors }, { status: 400 });
  }
  // ... continuar
}

// ❌ ERRADO — confiar no input sem validação
export async function POST(req: Request) {
  const body = await req.json();
  await prisma.lead.create({ data: body }); // SQL injection / dados inválidos
}
```

### 7.5 Nomenclatura de Documentos Financeiros

```
FT-SALA-YYYY-NNNNNN  → Fatura de sala de reunião
REC-YYYY-NNNNNN      → Recibo de pagamento
NL-YYYY-NNNNNN       → Nota de Liquidação
RES-YYYY-NNNNNN      → Número de reserva
```

---

## 8. Fluxo de Dados — Single Source of Truth

### 8.1 Princípio SSoT

> *Cada pedaço de informação tem exactamente um proprietário. Outros módulos lêem do proprietário, nunca mantêm cópias locais.*

| Dado | Proprietário (SSoT) | Outros módulos fazem |
|---|---|---|
| Estado de um Lead | Tabela `Lead` | Lêem via `leadId` |
| Dados de uma Empresa | Tabela `Company` | Referenciam via `companyId` |
| Total de uma Fatura | Tabela `Invoice` | Calculado a partir dos `InvoicePayment` |
| Saldo de uma Empresa | `FinancialHistory.runningBalance` (último) | Lêem o campo, não recalculam |
| Preço de uma Reserva | Calculado por `PricingService` no momento da reserva | Guardado em `Reservation.totalAmount` |

### 8.2 Anti-Padrões Proibidos

```typescript
// ❌ PROIBIDO — duplicar dados de empresa na reserva
const reservation = await prisma.reservation.create({
  data: {
    companyName: "CARLOTA 360",    // ← duplicado de Company.name
    companyEmail: "email@...",     // ← duplicado de Company.email
    companyPhone: "9XX XXX XXX",   // ← duplicado de Company.whatsapp
    companyId: "cld_xxx",          // ← a FK é suficiente!
  }
});

// ✅ CORRECTO — apenas a FK, dados lidos dinamicamente
const reservation = await prisma.reservation.create({
  data: {
    companyId: "cld_xxx",  // ← lookup via include: { company: true }
    companyName: input.companyName, // ← apenas para clientes externos (sem Company)
    ...
  }
});
```

---

## 9. Observabilidade

### 9.1 Logs

- **Desenvolvimento:** `console.error` para erros, `console.log` para debug
- **Produção (futuro):** integração com Vercel Logs / Sentry / Datadog

### 9.2 Auditoria

A tabela `FinancialAudit` regista todas as operações financeiras sensíveis com:
- Acção realizada
- Entidade e ID afectado
- Utilizador que realizou
- IP do pedido
- Timestamp

Futuramente, criar `SystemAudit` para operações não-financeiras (eliminações, alterações de roles, etc.).

### 9.3 Timeline

A tabela `Timeline` regista eventos de negócio relevantes ligados a `Company` ou `Lead`, visíveis na UI para a equipa operacional.

---

## 10. Escalabilidade

### 10.1 Estado Actual (Vercel + Supabase)

```
Clientes → Vercel Edge → Next.js Server → Supabase PostgreSQL
                                        → Cloudinary (activos)
```

Adequado para: até ~1000 utilizadores simultâneos, 100k registos

### 10.2 Arquitectura para Escala (Multi-tenant SaaS)

Quando necessário, a transição para:

```
Clientes → CDN (Cloudflare) → Load Balancer
                             → Pod 1 (Next.js) ─┐
                             → Pod 2 (Next.js) ─┤→ PostgreSQL (Primary)
                             → Pod 3 (Next.js) ─┘       ↕ replication
                                                 → PostgreSQL (Read Replica)
                                                 → Redis (Cache + Event Bus)
                                                 → S3 (activos)
```

**Preparação já feita:** O Event Bus tem interface idêntica ao Redis Pub/Sub. Migrar requer apenas trocar a implementação, não o código cliente.

---

*VD Platform — Architecture v1.0.0 — Julho 2026*
