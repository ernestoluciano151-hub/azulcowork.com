# Baseline Arquitectural — VD Platform

> **Documento:** ARCH-BASELINE-001  
> **Estado:** ✅ Aprovado — Marco Zero  
> **Data:** 26 de Julho de 2026  
> **Propósito:** Snapshot oficial da arquitectura **antes** da primeira alteração estrutural do código (Sprint P0-A).  
> **Aprovação:** Ernesto Pinto Luciano — Product Owner  
> **Autoridade:** Este documento é a referência imutável para comparação após a conclusão da Fase P0. Não deve ser editado — qualquer divergência é registada no documento `docs/architecture/post-p0.md` após a conclusão da Fase P0.

---

## 1. Estado Actual do Projecto

### 1.1 Sumário Executivo

| Métrica | Valor |
|---|---|
| Linhas de código (TypeScript/TSX) | **17 239** |
| Ficheiros fonte totais | **126** |
| API Routes | **56** |
| Modelos Prisma | **21** |
| Enums Prisma | **0** (roles como `String`) |
| Componentes React | **26** (15 admin · 2 finance · 9 public) |
| Páginas Next.js | **21** |
| Services (`src/lib/`) | **17 ficheiros** |
| Services com lógica de negócio | **3** (`finance-service`, `pricing-service`, `notifications`) |
| Repositories | **0** (padrão não implementado) |
| Middlewares | **1** (`src/middleware.ts`) |
| Testes unitários | **0** |
| Cobertura de testes | **0%** |
| Score global de qualidade | **58/100** |

### 1.2 Estrutura de Directórios

```
leadgen-crm/
├── prisma/
│   ├── schema.prisma          # 21 modelos, 0 enums — fonte de verdade do DB
│   └── seed.js
├── src/
│   ├── app/
│   │   ├── api/               # 56 API Routes (Route Handlers Next.js)
│   │   │   ├── admin/         # 8 routes  — gestão de utilizadores e configurações
│   │   │   ├── auth/          # 2 routes  — login, logout
│   │   │   ├── companies/     # 4 routes  — empresas coworking
│   │   │   ├── employees/     # 2 routes  — colaboradores
│   │   │   ├── expenses/      # 2 routes  — despesas
│   │   │   ├── export-crm/    # 1 route   — exportação CRM
│   │   │   ├── finance/       # 4 routes  — relatórios financeiros
│   │   │   ├── invoices/      # 4 routes  — faturas + PDF
│   │   │   ├── leads/         # 4 routes  — CRM leads
│   │   │   ├── notifications/ # 3 routes  — notificações
│   │   │   ├── payments/      # 3 routes  — pagamentos
│   │   │   ├── plans/         # 2 routes  — planos de reunião
│   │   │   ├── reservations/  # 3 routes  — reservas de sala
│   │   │   ├── room-booking-leads/ # 4 routes — leads sala → reserva
│   │   │   ├── rooms/         # 3 routes  — salas
│   │   │   ├── salas/         # 1 route   — relatórios salas
│   │   │   ├── search/        # 1 route   — pesquisa global
│   │   │   ├── timeline/      # 1 route   — timeline de eventos
│   │   │   ├── atividades/    # 1 route   — actividades
│   │   │   ├── delete-requests/ # 2 routes — pedidos de eliminação
│   │   │   └── upload/        # 1 route   — Cloudinary upload
│   │   ├── admin/             # 21 páginas do painel admin
│   │   ├── salas/             # Landing page de salas de reunião
│   │   ├── obrigado/          # Página de confirmação
│   │   └── page.tsx           # Landing page principal
│   ├── components/
│   │   ├── admin/             # 15 componentes do painel admin
│   │   ├── finance/           # 2 componentes financeiros
│   │   └── [public]/          # 9 componentes da landing page
│   ├── lib/                   # 17 ficheiros de lógica de negócio e utilitários
│   ├── styles/
│   └── types/
│       └── jsx.d.ts
├── docs/                      # Documentação oficial
├── next.config.js
├── tsconfig.json
└── package.json
```

### 1.3 API Routes por Bounded Context

| Bounded Context | Routes | Ficheiros |
|---|---|---|
| Security / Auth | 2 | `auth/login`, `auth/logout` |
| Admin | 8 | `admin/users`, `admin/me`, `admin/change-password`, `admin/room-pricing`, `admin/room-settings`, `admin/stats` |
| CRM | 4 | `leads/` (CRUD + export CSV + export XLSX) |
| Cowork | 6 | `companies/` (CRUD + payments + alerts) + `employees/` |
| Financial | 13 | `finance/` (4) + `invoices/` (4) + `payments/` (3) + `expenses/` (2) |
| Reservation | 11 | `reservations/` (3) + `rooms/` (3) + `room-booking-leads/` (4) + `salas/reports` (1) |
| Communication | 3 | `notifications/` |
| System | 9 | `search`, `timeline`, `upload`, `atividades`, `delete-requests`, `plans`, `export-crm` |
| **TOTAL** | **56** | |

### 1.4 Modelos Prisma (21 modelos)

| Bounded Context | Modelos |
|---|---|
| CRM | `Lead`, `RoomBookingLead`, `Note` |
| Security | `AdminUser`, `DeleteRequest` |
| Cowork | `Company`, `Employee` |
| Financial | `Payment`, `Invoice`, `InvoicePayment`, `LiquidationNote`, `FinancialAudit`, `FinancialHistory`, `Expense`, `RevenueCategory` |
| Reservation | `Reservation`, `MeetingPlan`, `RoomPricing`, `RoomSettings` |
| System | `Timeline`, `Notification` |

### 1.5 Services (`src/lib/`)

| Ficheiro | Linhas | Responsabilidade |
|---|---|---|
| `finance-service.ts` | 261 | `confirmPayment()` — cadeia de 10 passos em `$transaction` |
| `pricing-service.ts` | 120 | Cálculo de preços por hora/meio-dia/dia/coffee break |
| `notifications.ts` | 147 | Criação de notificações no sistema |
| `event-bus.ts` | 369 | Event Bus tipado (28 tipos de evento) |
| `event-handlers.ts` | 277 | Handlers registados para todos os eventos |
| `email.ts` | 239 | Templates de email (Nodemailer) |
| `invoice-pdf.tsx` | 407 | Geração de faturas PDF (@react-pdf/renderer) |
| `receipt-pdf.tsx` | 281 | Geração de recibos PDF (@react-pdf/renderer) |
| `auth.ts` | 38 | `createSession`, `getSession`, `destroySession` (JWT) |
| `finance.ts` | 121 | `calcFinancialStatus`, `calcContractMonths` |
| `timeline.ts` | 60 | Criação de eventos de timeline |
| `rateLimit.ts` | 45 | Rate limiting em memória (leads + login) |
| `validators.ts` | 12 | Validação de email, WhatsApp, sanitização de texto |
| `bootstrap.ts` | 22 | Inicialização do Event Bus (server-side) |
| `prisma.ts` | 12 | Singleton Prisma Client |
| `currency.ts` | 3 | `formatKz()` — formatação de moeda AOA |
| `countryCode.ts` | 47 | Lista de prefixos telefónicos |

### 1.6 Componentes React (26 componentes)

**Admin (15):** `AdminLayout`, `CompanyModal`, `DeleteRequestModal`, `EmployeesPanel`, `GlobalSearch`, `LeadModal`, `LeadsChart`, `NotificationBell`, `ReservationModal`, `RoomModal`, `Sidebar`, `StatsCard`, `TopBar`  
**Finance (2):** `FinanceDashboard`, `NewPaymentModal`  
**Landing Page (9):** `Benefits`, `Contact`, `Gallery`, `Hero`, `LeadForm`, `MeetingPlans`, `Navbar`, `Pricing`, `SalaBookingForm`, `Spaces`, `VSL`

### 1.7 Middleware

**Ficheiro:** `src/middleware.ts`  
**Protecção:** Todas as rotas `/admin/*` (excepto `/admin/login`)  
**RBAC no middleware:** Apenas 3 paths específicos verificam `role === "ADMIN"` (`/admin/delete-requests`, `/admin/configuracoes`, `/admin/settings`)  
**RBAC nas API Routes:** Apenas `/api/admin/users` verifica role — **as restantes 55 routes verificam apenas existência de sessão**

---

## 2. Dependências

### 2.1 Runtime Dependencies

| Biblioteca | Versão | Propósito |
|---|---|---|
| `next` | 15.5.21 | Framework web (App Router, RSC, API Routes) |
| `react` / `react-dom` | 18.3.1 | UI |
| `@prisma/client` | 5.22.0 | ORM — acesso ao PostgreSQL |
| `jose` | 5.6.3 | JWT (HS256) — compatível com Edge Runtime |
| `bcryptjs` | 2.4.3 | Hash de passwords — JavaScript puro |
| `nodemailer` | 9.0.1 | Envio de emails transaccionais (SMTP) |
| `cloudinary` | 2.10.0 | Upload e gestão de imagens |
| `@react-pdf/renderer` | 4.5.1 | Geração de PDFs (faturas, recibos) |
| `pdfkit` | 0.19.1 | Segunda biblioteca de PDF (DRY violation — DT-005) |
| `date-fns` | 3.6.0 | Manipulação de datas |
| `recharts` | 3.9.0 | Gráficos do dashboard |
| `exceljs` | 4.4.0 | Export para XLSX (leads) |
| `react-day-picker` | 8.10.1 | Seletor de datas no calendário |
| `react-is` | 19.2.7 | Utilitário React |

### 2.2 Dev Dependencies

| Biblioteca | Versão | Propósito |
|---|---|---|
| `prisma` | 5.22.0 | CLI de migrations e geração de client |
| `typescript` | 5.9.3 | Tipagem estática |
| `tailwindcss` | 3.4.4 | CSS utility-first |
| `autoprefixer` / `postcss` | — | Processamento de CSS |

### 2.3 Serviços Externos

| Serviço | Propósito | SDK |
|---|---|---|
| **PostgreSQL via Supabase/Neon** | Base de dados relacional | `prisma` (connection string) |
| **Cloudinary** | Armazenamento e CDN de imagens | `cloudinary` SDK |
| **SMTP (Nodemailer)** | Email transaccional | `nodemailer` |
| **Vercel** | Hosting e deploy | Next.js nativo |

> **Nota:** Não existe integração com Resend. O email é enviado via SMTP com Nodemailer.  
> **Nota:** Não existe SDK Neon/Supabase directo — a ligação é feita via `DATABASE_URL` no Prisma.

### 2.4 Configuração TypeScript

```json
{
  "strict": true,
  "noEmit": true,
  "target": "ES2020",
  "module": "esnext",
  "moduleResolution": "bundler"
}
```

> **⚠️ ATENÇÃO:** Apesar de `"strict": true` no `tsconfig.json`, o `next.config.js` tem `typescript: { ignoreBuildErrors: true }` — os erros de TypeScript são **silenciados no build** (DT-001).

---

## 3. Métricas Actuais (Baseline)

### 3.1 Score Global: 58 / 100

| Categoria | Score | Peso | Contribuição |
|---|---|---|---|
| Funcionalidade | 88% | 20% | 17.6 |
| Segurança | **42%** | 25% | 10.5 |
| Testes | **0%** | 20% | 0.0 |
| Arquitectura | 61% | 15% | 9.2 |
| Qualidade de Código | 58% | 10% | 5.8 |
| Performance | 68% | 5% | 3.4 |
| Observabilidade | **15%** | 5% | 0.75 |
| **TOTAL** | | | **47.25 → 58/100** |

### 3.2 Cobertura de Testes

| Módulo | Cobertura Actual | Target P0 |
|---|---|---|
| `pricing-service.ts` | 0% | 95% |
| `finance-service.ts` | 0% | 70% |
| `finance.ts` | 0% | 80% |
| `validators.ts` | 0% | 100% |
| `document-numbering.ts` | 0% (não existe ainda) | 90% |
| Global | **0%** | **≥ 60%** |

### 3.3 Security Score: 42/100

| Item | Estado |
|---|---|
| JWT fallback secret (`"fallback-secret-troque-me"`) | ❌ CRÍTICO |
| RBAC: apenas 1/56 routes verifica role | ❌ CRÍTICO |
| TOTP 2FA schema presente mas não integrado no login | ❌ CRÍTICO |
| Cookies httpOnly + secure (produção) | ✅ OK |
| bcrypt para passwords | ✅ OK |
| Rate limiting no login | ✅ OK |
| Headers de segurança (CSP, HSTS, X-Frame) | ✅ OK |
| Bot detection (honeypot + tempo) | ✅ OK |
| Timing attack prevention (bcrypt dummy) | ✅ OK |

### 3.4 Architecture Score: 61/100

| Item | Estado |
|---|---|
| Event-Driven Architecture (Event Bus) | ✅ Implementado |
| Clean Architecture (Services) | ✅ Parcial (3 services) |
| Bounded Contexts definidos | ✅ Documentados |
| Repository Pattern | ❌ Não implementado |
| `prisma.$transaction()` em FinanceService | ✅ Implementado |
| Conflict check de reservas DENTRO da transacção | ❌ TOCTOU (DATA-001) |
| Numeração de documentos atómica | ❌ Race condition (DATA-002) |
| `recordFinancialHistory` dentro do contexto tx | ❌ Fora da tx (DATA-003) |
| DRY: `formatKz` duplicado | ❌ (invoice-pdf.tsx) |
| DRY: lógica financeira duplicada (reservas vs FinanceService) | ❌ |

### 3.5 Performance

| Item | Estado |
|---|---|
| Paginação em `/api/leads` | ✅ |
| Paginação em `/api/finance/sala` | ❌ — `findMany` sem `take` |
| Queries N+1 em `payment.received` handler | ❌ (PERF-002) |
| Ocupação hardcoded `22 × 8 = 176h` | ❌ — ignora `RoomSettings` |

### 3.6 Observabilidade: 15/100

| Item | Estado |
|---|---|
| Sentry / Error monitoring | ❌ Não configurado |
| Logging estruturado | ❌ Apenas `console.error` |
| Métricas de runtime | ❌ |
| Trace de eventos de domínio | ✅ Parcial (Event Bus logs) |

---

## 4. Mapa de Dependências

### 4.1 Dependências entre Módulos

```
src/lib/prisma.ts
  └── usado por: TODOS os services, handlers, API routes

src/lib/auth.ts
  └── usado por: src/middleware.ts
  └── usado por: todas as API routes (via getSession())
  └── usado por: src/app/api/auth/login/route.ts (createSession)
  └── usado por: src/app/api/auth/logout/route.ts (destroySession)

src/lib/event-bus.ts
  └── usado por: src/lib/event-handlers.ts (subscribe)
  └── usado por: src/app/api/leads/route.ts (publish lead.created)
  └── usado por: src/app/api/companies/route.ts (publish company.created)
  └── usado por: src/app/api/reservations/route.ts (publish reservation.created)
  └── usado por: src/app/api/payments/ (publish payment.received)
  └── usado por: src/lib/bootstrap.ts (inicialização)

src/lib/event-handlers.ts
  └── depende de: event-bus.ts, notifications.ts, email.ts, prisma.ts

src/lib/finance-service.ts
  └── depende de: prisma.ts, event-bus.ts
  └── usado por: src/app/api/reservations/[id]/receive-payment/route.ts

src/lib/pricing-service.ts
  └── depende de: prisma.ts
  └── usado por: src/app/api/reservations/route.ts

src/lib/notifications.ts
  └── depende de: prisma.ts
  └── usado por: event-handlers.ts

src/lib/email.ts
  └── depende de: nodemailer (externo)
  └── usado por: event-handlers.ts

src/lib/finance.ts
  └── depende de: (sem dependências internas)
  └── usado por: src/app/api/finance/company/[id]/route.ts
  └── usado por: src/app/api/companies/route.ts (indirectamente)

src/lib/invoice-pdf.tsx
  └── depende de: @react-pdf/renderer (externo)
  └── usado por: src/app/api/invoices/[id]/download/route.ts

src/lib/receipt-pdf.tsx
  └── depende de: @react-pdf/renderer (externo)
  └── usado por: src/app/api/invoices/[id]/receipt/route.ts

src/middleware.ts
  └── depende de: jose (externo), JWT_SECRET (env)
  └── executa em: Vercel Edge Runtime (antes de qualquer request /admin/*)

src/lib/rateLimit.ts
  └── depende de: (sem dependências — in-memory Maps)
  └── usado por: src/app/api/leads/route.ts
  └── usado por: src/app/api/auth/login/route.ts
```

### 4.2 Dependências Críticas de Ambiente

| Variável | Usada em | Impacto se ausente |
|---|---|---|
| `JWT_SECRET` | `auth.ts`, `middleware.ts` | Usa fallback `"fallback-secret-troque-me"` — **CRÍTICO** |
| `DATABASE_URL` | `prisma.ts` | Falha total — sem DB |
| `CLOUDINARY_CLOUD_NAME` | `upload/route.ts` | Upload de imagens falha |
| `CLOUDINARY_API_KEY` | `upload/route.ts` | Upload de imagens falha |
| `CLOUDINARY_API_SECRET` | `upload/route.ts` | Upload de imagens falha |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | `email.ts` | Emails não são enviados |
| `SENTRY_DSN` | — | Não configurado (DT-009) |

---

## 5. Fluxo de Autenticação (Estado Actual)

```
[Browser]
    │
    ├─→ POST /api/auth/login
    │       │
    │       ├── isLoginRateLimited(ip) → 429 se exceder 10 req/15min
    │       │
    │       ├── AdminUser.findUnique({ email })
    │       │       └── Se não encontrado: bcrypt.compare("", dummyHash) [timing attack prevention]
    │       │                                → 401 (sem revelar se email existe)
    │       │
    │       ├── bcrypt.compare(password, user.passwordHash)
    │       │       └── Se inválida → 401
    │       │
    │       ├── ⚠️ TOTP NÃO VERIFICADO (mesmo se totpEnabled: true)
    │       │
    │       ├── createSession({ sub: user.id, email, role, name })
    │       │       └── JWT HS256, 12h, cookie httpOnly
    │       │           ⚠️ Usa JWT_SECRET || "fallback-secret-troque-me"
    │       │
    │       └── 200 OK
    │
    ├─→ GET /admin/* (qualquer rota protegida)
    │       │
    │       └── src/middleware.ts
    │               ├── Verifica cookie vd_admin_session
    │               ├── jwtVerify(token, secret) → 302 /admin/login se inválido
    │               ├── Se ADMIN_ONLY_PATHS → verifica payload.role === "ADMIN"
    │               └── NextResponse.next() → request segue
    │
    ├─→ GET /api/* (API Routes)
    │       │
    │       └── getSession() em cada route handler
    │               ├── Se null → 401 { error: "Não autorizado" }
    │               └── ⚠️ Role NÃO verificada (excepto /api/admin/users)
    │
    └─→ POST /api/auth/logout
            └── destroySession() → cookie limpo
```

**Vulnerabilidades identificadas:**
- `SEC-001`: JWT fallback secret usado em produção se `JWT_SECRET` não está definida
- `SEC-002`: 55/56 API Routes sem verificação de role
- `SEC-003`: TOTP schema presente mas fluxo não implementado

---

## 6. Fluxo Financeiro (Estado Actual)

```
FLUXO PRINCIPAL — Confirmação de Pagamento de Coworking:

POST /api/reservations/[id]/receive-payment
    │
    └── getSession() → 401 se não autenticado
        ⚠️ Role NÃO verificada (qualquer utilizador autenticado pode confirmar pagamentos)
        │
        └── FinanceService.confirmPayment(reservationId, paymentData)
                │
                └── prisma.$transaction(async (tx) => {
                        1. tx.reservation.findUnique() — valida existência
                        2. tx.reservation.update() — status → CONFIRMADA
                        3. tx.invoice.create() — cria factura (FT-SALA-YYYY-NNNNNN)
                           ⚠️ Numeração usa count() + 1 — race condition possível
                        4. tx.payment.create() — regista pagamento
                        5. tx.invoicePayment.create() — associa payment à invoice
                        6. tx.liquidationNote.create() — cria nota de liquidação
                        7. tx.financialAudit.create() — registo de auditoria
                        8. tx.financialHistory.create() — histórico (⚠️ dentro tx — correcto)
                           ⚠️ Nota: versão anterior tinha recordFinancialHistory() FORA da tx
                        9. tx.reservation.update() — status → PAGA
                       10. publish("payment.received", {...}) — evento de domínio
                    })
```

**Fluxo Alternativo — Reserva com PAGAR_AGORA:**
```
POST /api/reservations
    │
    └── ⚠️ Lógica financeira DUPLICADA (não usa FinanceService)
        Cria Invoice + Payment + LiquidationNote directamente na route
        (violação DRY — ARCH-001)
```

---

## 7. Fluxo CRM (Estado Actual)

```
FLUXO DE CAPTAÇÃO DE LEAD:

[Landing Page /]
    │
    └── POST /api/leads (público)
            │
            ├── isLeadRateLimited(ip) → 429 se > 5 req/10min
            ├── looksLikeBot(body) → 422 se honeypot preenchido ou < 1.5s
            ├── Validação manual dos campos
            │
            ├── ⚠️ SEM verificação de email duplicado (BR-004 não implementado)
            │
            ├── prisma.lead.create()
            │
            ├── publish("lead.created", {...})
            │       └── event-handlers → sendNewLeadEmail (admin)
            │                         → createNotification
            │
            └── 201 Created

FLUXO DE GESTÃO DE LEAD (Admin):

GET /api/leads — lista paginada com filtros (status, search, sort)
PATCH /api/leads/[id] — actualizar status/notas
    └── getSession() → 401
        ⚠️ Role NÃO verificada
        ⚠️ _adminCreate flag bypassa bot check mas requer só sessão

CONVERSÃO DE LEAD → EMPRESA:
PATCH /api/leads/[id] com { status: "CONVERTIDO" }
    └── publish("lead.converted", {...})
            └── Cria Company + Contrato no handler
```

---

## 8. Fluxo de Reservas (Estado Actual)

```
CRIAÇÃO DE RESERVA:

POST /api/reservations
    │
    ├── getSession() → 401 se não autenticado
    ├── PricingService.calcPrice() → calcula custo
    │
    ├── ⚠️ Conflict Check (BR-030) FORA da transacção — TOCTOU:
    │   prisma.reservation.findFirst({ where: { overlap } })
    │   → Se existe → 409 Conflict
    │   ← JANELA DE RACE CONDITION AQUI
    │
    ├── prisma.$transaction(async (tx) => {
    │       ⚠️ Conflict check NÃO repetido dentro da tx
    │       tx.reservation.create()
    │       [Se PAGAR_AGORA]: tx.invoice.create() + tx.payment.create() (lógica duplicada)
    │   })
    │
    ├── publish("reservation.created", {...})
    └── 201 Created

CONFIRMAÇÃO DE PAGAMENTO DE RESERVA:
POST /api/reservations/[id]/receive-payment
    └── → FinanceService.confirmPayment() [ver fluxo financeiro]

GESTÃO:
GET /api/reservations — lista com filtros (room, status, date range)
GET /api/rooms/[id]/reservations — reservas por sala
PATCH /api/reservations/[id] — actualizar
DELETE /api/reservations/[id] — cancelar
```

---

## 9. Fluxo ERP — Coworking (Estado Actual)

```
CRIAÇÃO DE EMPRESA:
POST /api/companies
    │
    ├── getSession() → 401
    │   ⚠️ Role NÃO verificada
    │
    ├── prisma.company.create() + prisma.payment.createMany() [pendentes mensais]
    │   ⚠️ NÃO usa prisma.$transaction() — risco de inconsistência
    │
    ├── publish("company.created", {...})
    └── 201

GESTÃO FINANCEIRA DE EMPRESA:
GET /api/finance/company/[id] — overview financeiro
GET /api/companies/[id]/payments — pagamentos da empresa
POST /api/payments/generate-monthly — gera parcelas mensais

ALERTAS DE CONTRATO:
GET /api/companies/alerts
    └── Calcula dias restantes de contrato
        publish("company.contractExpiringSoon") para contratos próximos do fim

DESPESAS (ERP):
POST /api/expenses — registar despesa
GET /api/finance/summary — resumo receitas vs despesas
GET /api/finance/report — relatório detalhado
GET /api/finance/sala — relatório de sala de reunião
    ⚠️ findMany() SEM take — carrega TODAS as reservas em memória
    ⚠️ Ocupação hardcoded: 22 dias × 8h = 176h/mês
```

---

## 10. Fluxo de Comunicação (Estado Actual)

```
EVENT-DRIVEN (assíncrono, em memória):

[Operação de negócio]
    │
    └── publish(evento, payload)
            │
            └── event-handlers.ts (subscrito no bootstrap)
                    │
                    ├── "lead.created"
                    │       └── sendNewLeadEmail(admin)
                    │           createNotification(admin)
                    │
                    ├── "lead.converted"
                    │       └── sendReservationConfirmationEmail (se aplicável)
                    │
                    ├── "reservation.created"
                    │       └── sendNewReservationAdminEmail()
                    │           createNotification()
                    │
                    ├── "payment.received"
                    │       └── prisma.invoice.findFirst() ← 3 queries extra (PERF-002)
                    │           prisma.company.findFirst()
                    │           sendPaymentConfirmationEmail()
                    │           createNotification()
                    │
                    └── "company.contractExpiringSoon"
                            └── createNotification(admin)

EMAILS (via Nodemailer):
  sendNewLeadEmail()             — Novo lead para admin
  sendReservationConfirmationEmail() — Confirmação ao cliente
  sendNewReservationAdminEmail() — Nova reserva para admin
  sendNewRoomLeadEmail()         — Lead de sala para admin
  ⚠️ Erro encontrado:
     Linha 123: WhatsApp hardcoded "+244 925 000 000" (errado)
     Linha 125: URL hardcoded "azulcoworking.ao" (errado — deve ser azulcowork.com)

NOTIFICAÇÕES IN-APP:
  GET /api/notifications — lista
  PATCH /api/notifications/[id] — marcar como lida
  PATCH /api/notifications/read-all — marcar todas como lidas
```

---

## 11. Principais Dívidas Técnicas

| ID | Severidade | Dívida | Sprint P0 |
|---|---|---|---|
| **DT-011** | 🔴 Crítico | JWT fallback secret `"fallback-secret-troque-me"` em `auth.ts` e `middleware.ts` | P0-A |
| **DT-012** | 🔴 Crítico | RBAC ausente em 55/56 API Routes | P0-A |
| **DT-013** | 🔴 Crítico | TOCTOU: conflict check de reservas fora de `$transaction` | P0-B |
| **DT-014** | 🔴 Crítico | Race condition na numeração de documentos (`count() + 1`) | P0-B |
| **DT-016** | 🔴 Crítico | TOTP 2FA presente no schema mas não integrado no login | P0-D |
| **DT-017** | 🔴 Crítico | `recordFinancialHistory` foi corrigida mas lógica duplicada em `reservations/route.ts` | P0-B |
| **DT-002** | 🔴 Crítico | Zero testes unitários em toda a plataforma | P0-C |
| **DT-001** | 🟠 Alto | `typescript: { ignoreBuildErrors: true }` — erros TypeScript silenciados | P0-D |
| **DT-009** | 🟠 Alto | Sem Sentry / error monitoring em produção | P0-D |
| **DT-010** | 🟠 Alto | Rate limiting in-memory — não funciona em múltiplas instâncias Vercel | P0-D |
| **DT-003** | 🟠 Alto | Role `AdminUser.role` como `String` — sem enum tipado | P0-A |
| **DT-005** | 🟡 Médio | Duas bibliotecas PDF (`@react-pdf/renderer` + `pdfkit`) — padronizar | Fase 1 |
| **DT-018** | 🟡 Médio | `formatKz` duplicado em `invoice-pdf.tsx` e `currency.ts` | P0-C |
| **DT-019** | 🟡 Médio | Email `email.ts`: WhatsApp e URL hardcoded incorrectos | P0-A |
| **DT-020** | 🟡 Médio | `admin/users` cria roles: `"ADMIN"` ou `"USER"` — COMERCIAL/FINANCEIRO/VIEWER nunca atribuídos | P0-A |
| **DT-006** | 🟡 Médio | SQLite em dev vs PostgreSQL em produção — risco de comportamentos divergentes | Fase 1 |
| **DT-007** | 🟡 Médio | `/api/finance/sala`: `findMany` sem `take` — carga total em memória | P0-B |
| **DT-008** | 🟡 Médio | Sem Zod para validação de schema nos endpoints — `any` em vários params | Fase 1 |
| **DT-015** | 🟡 Médio | Lógica financeira duplicada: `reservations/route.ts` recria o que `FinanceService` já faz | P0-B |
| **DT-004** | 🟢 Baixo | Event Bus in-memory — sem persistência; migrar para Redis em Fase 2 | Fase 2 |

---

## 12. Principais Riscos

| ID | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| **RISK-001** | JWT_SECRET não definida em produção → sessões forjáveis por qualquer pessoa com acesso ao fallback | Alta | **Catastrófico** | Sprint P0-A: forçar `JWT_SECRET` obrigatória e lançar erro se ausente |
| **RISK-002** | Utilizador autenticado com role VIEWER pode confirmar pagamentos, eliminar empresas, modificar dados críticos | Média | **Crítico** | Sprint P0-A: RBAC em todas as API Routes |
| **RISK-003** | Duas reservas concorrentes para o mesmo horário passam o conflict check (TOCTOU) | Média | **Alto** | Sprint P0-B: mover conflict check para dentro de `$transaction` |
| **RISK-004** | Duas faturas com o mesmo número geradas concorrentemente (race condition em `count() + 1`) | Baixa | **Alto** (ilegal) | Sprint P0-B: `DocumentCounter` com upsert atómico |
| **RISK-005** | Utilizador com `totpEnabled: true` autentica-se sem código TOTP | Alta | **Crítico** | Sprint P0-D: fluxo TOTP em dois passos |
| **RISK-006** | Erro silencioso em produção — sem Sentry, falhas críticas são invisíveis | Alta | **Alto** | Sprint P0-D: Sentry |
| **RISK-007** | Build passa com erros TypeScript graves (`ignoreBuildErrors: true`) | Alta | **Médio** | Sprint P0-D: remover flag |
| **RISK-008** | Rate limiting in-memory não funciona em deploy multi-instância (Vercel auto-scale) | Baixa | **Médio** | Sprint P0-D: avaliar Redis ou Upstash |

---

## 13. Módulos Mais Críticos

Por ordem de criticalidade (falha = impacto máximo no negócio):

| Rank | Módulo | Criticidade | Razão |
|---|---|---|---|
| 1 | `src/lib/auth.ts` + `src/middleware.ts` | 🔴 Máxima | Controla acesso a TUDO. Vulnerabilidade = breach total |
| 2 | `src/lib/finance-service.ts` | 🔴 Máxima | Operações financeiras irreversíveis; integridade transaccional |
| 3 | `prisma/schema.prisma` | 🔴 Máxima | Alteração incorrecta = corrupção de dados ou migration falhada |
| 4 | `src/lib/event-bus.ts` | 🟠 Alta | Falha silencia eventos de domínio; sem retry automático |
| 5 | `src/app/api/reservations/route.ts` | 🟠 Alta | TOCTOU + numeração + lógica financeira duplicada |
| 6 | `src/lib/pricing-service.ts` | 🟠 Alta | Cálculo errado = cobranças incorrectas |
| 7 | `src/lib/email.ts` | 🟡 Média | Falha = clientes sem confirmações; URLs erradas nos emails |
| 8 | `src/app/api/auth/login/route.ts` | 🟠 Alta | Ponto de entrada único para admin; TOTP não implementado |

---

## 14. Módulos que NÃO Podem Sofrer Breaking Changes

Os seguintes módulos têm contrato público estabilizado. Qualquer alteração deve ser **retrocompatível** ou exigir aprovação explícita do Product Owner com ADR:

| Módulo | Contrato Estabilizado | Razão |
|---|---|---|
| `src/lib/event-bus.ts` — interface `publish/subscribe` | `publish<T>(event, payload)` / `subscribe<T>(event, handler)` | Migração futura para Redis deve ser transparente (ADR-003) |
| `src/lib/auth.ts` — cookie `vd_admin_session` | Nome do cookie, payload JWT (`sub`, `email`, `role`, `name`) | Sessões activas invalidadas se mudar |
| `prisma/schema.prisma` — campos financeiros | `Invoice`, `Payment`, `LiquidationNote`, `FinancialAudit` — todos os campos obrigatórios | Dados históricos imutáveis |
| `src/lib/finance-service.ts` — assinatura `confirmPayment` | `confirmPayment(reservationId, data)` → `Promise<{...}>` | Chamado por route handler crítico |
| Numeração de documentos (`FT-SALA-YYYY-NNNNNN`, `REC-YYYY-NNNNNN`, etc.) | Formato dos prefixos | Documentos emitidos são registos legais imutáveis |
| Cookie de sessão (`httpOnly`, `secure`, `sameSite: lax`) | Configuração de segurança do cookie | Alteração pode abrir XSS/CSRF |

---

## 15. Critérios de Comparação Pós-Fase P0

Este documento será comparado com `docs/architecture/post-p0.md` no final da Fase P0 (Setembro 2026). Os critérios de sucesso são:

### 15.1 Segurança (de 42% → 80%)

| Critério | Baseline (Jul 2026) | Target (Set 2026) |
|---|---|---|
| JWT fallback secret | ❌ Presente | ✅ Removido — erro se `JWT_SECRET` ausente |
| RBAC em API Routes | ❌ 1/56 (1.8%) | ✅ 56/56 (100%) |
| TOTP integrado no login | ❌ Não implementado | ✅ Fluxo dois passos funcional |
| Roles como enum | ❌ String livre | ✅ Enum `AdminRole` no schema Prisma |
| Emails com dados correctos | ❌ WhatsApp e URL errados | ✅ Corrigidos |

### 15.2 Integridade de Dados (de 61% → 85%)

| Critério | Baseline | Target |
|---|---|---|
| Conflict check de reservas | ❌ TOCTOU (fora de tx) | ✅ Dentro de `$transaction` |
| Numeração de documentos | ❌ Race condition (`count+1`) | ✅ `DocumentCounter` atómico |
| Lógica financeira duplicada | ❌ Em `reservations/route.ts` | ✅ Centralizada em `FinanceService` |
| `findMany` sem paginação em `/finance/sala` | ❌ Carga total em memória | ✅ Com `take/skip` |

### 15.3 Testes (de 0% → 60%+)

| Critério | Baseline | Target |
|---|---|---|
| Cobertura global | 0% | ≥ 60% |
| `pricing-service.ts` | 0% | ≥ 95% |
| `finance-service.ts` | 0% | ≥ 70% |
| `finance.ts` | 0% | ≥ 80% |
| `validators.ts` | 0% | 100% |
| `document-numbering.ts` | 0% (não existe) | ≥ 90% |
| `npm test` | ❌ Comando não existe | ✅ Zero falhas |

### 15.4 Qualidade de Código (de 58% → 75%)

| Critério | Baseline | Target |
|---|---|---|
| `typescript: ignoreBuildErrors` | ❌ `true` | ✅ Removido |
| Duplicação `formatKz` | ❌ Duplicado | ✅ Centralizado |
| `any` não justificado nas routes | ❌ Múltiplos | ✅ Tipados ou justificados |
| `npm run build` sem erros TypeScript | ❌ Erros silenciados | ✅ Build limpo |

### 15.5 Observabilidade (de 15% → 70%)

| Critério | Baseline | Target |
|---|---|---|
| Sentry activo em produção | ❌ Não configurado | ✅ DSN activo + source maps |
| Rate limiting multi-instância | ❌ In-memory | ✅ Avaliado (Upstash ou aceite com documentação) |

### 15.6 Score Global Esperado

| Momento | Score | Delta |
|---|---|---|
| **Baseline (Jul 2026)** | **58/100** | — |
| **Pós P0-A (Ago 2026 Semana 1)** | ~65/100 | +7 |
| **Pós P0-B (Ago 2026 Semana 2)** | ~69/100 | +4 |
| **Pós P0-C (Ago 2026 Semana 3)** | ~74/100 | +5 |
| **Target Pós P0-D (Set 2026)** | **≥ 72/100** | **+14** |
| **Target Dezembro 2026** | **85/100** | +27 |

---

*VD Platform — Architecture Baseline v1.0.0 — 26 de Julho de 2026*  
*Este documento é imutável. A comparação pós-Fase P0 será feita em `docs/architecture/post-p0.md`.*
