# Arquitectura — VD Platform v1.0.0

> **Documento:** RC-ARCH-001  
> **Versão:** 1.0.0 — 29 Julho 2026  
> **Baseline:** docs/00-foundation/architecture.md v1.0.0  
> **Alterações:** Adição de Volume 01 (CRM) e Volume 02 (ERP) ao diagrama

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js | 15.x |
| Linguagem | TypeScript | 5.x (strict) |
| ORM | Prisma | 5.22.0 |
| Base de Dados | PostgreSQL (Neon) | 16 |
| Autenticação | jose (JWT) | 5.x |
| CSS | Tailwind CSS | 3.x |
| Testes | Vitest | 4.1.10 |
| PDF | @react-pdf/renderer | 4.5.1 |
| Email | nodemailer | 9.0.1 |
| Excel | exceljs | 4.4.0 |
| Armazenamento | Cloudinary | 2.10.0 |
| Monitoring | Sentry | 8.x (config pronta) |
| Deploy | Vercel (Edge + Node runtime) | — |
| DB Host | Neon (serverless Postgres) | — |

---

## 2. Diagrama de Arquitectura (v1.0)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          CAMADA DE APRESENTAÇÃO                              │
│                                                                              │
│  ┌─────────────────┐  ┌──────────────────────────────────────────────────┐  │
│  │  Landing Page   │  │               Admin Panel (/admin/*)             │  │
│  │  /salas         │  │  ┌──────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  │  │
│  │  (público)      │  │  │ CRM  │  │ ERP │  │ Fin │  │Sala │  │Conf │  │  │
│  └─────────────────┘  │  └──────┘  └─────┘  └─────┘  └─────┘  └─────┘  │  │
│                        └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                         Next.js Middleware (auth check)
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                        CAMADA DE API (Route Handlers)                        │
│                                                                              │
│  AUTENTICAÇÃO          CRM                    ERP                            │
│  /api/auth/login       /api/crm/companies/**  /api/erp/contracts/**          │
│  /api/auth/logout      /api/crm/tasks/my      /api/erp/invoices/**           │
│  /api/auth/totp/verify /api/crm/tags/**       /api/erp/payments/**           │
│  /api/admin/totp/setup /api/crm/pipeline      /api/erp/expenses/**           │
│                        /api/crm/dashboard     /api/erp/cashflow/**           │
│  LEGADO                /api/crm/migrate-leads /api/erp/alerts/**             │
│  /api/leads/**                                /api/erp/dashboard             │
│  /api/companies/**     SALAS                  /api/erp/reports/**            │
│  /api/reservations/**  /api/rooms/**          /api/cron/erp-daily            │
│  /api/invoices/**      /api/reservations/**   /api/cron/erp-monthly-snapshot │
│  /api/payments/**      /api/salas/reports                                    │
│  /api/expenses/**                                                            │
│  /api/finance/**       INFRA                                                 │
│  /api/plans/**         /api/upload           Cross-cutting:                  │
│                        /api/search           • requireSession()              │
│                        /api/notifications/** • requireRole(...roles)         │
│                        /api/admin/**         • rateLimit()                   │
│                        /api/timeline         • validators.ts                 │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                         CAMADA DE APLICAÇÃO (Services)                       │
│                                                                              │
│  CORE                          CRM                   ERP                    │
│  finance-service.ts            crm-validators.ts     erp-contract-service   │
│  pricing-service.ts            pipeline-state-       erp-billing-service    │
│  document-numbering.ts           machine.ts          erp-payment-service    │
│  validators.ts                                       erp-expense-service    │
│  auth.ts                                             erp-receivables-svc    │
│  rateLimit.ts                                        erp-cashflow-service   │
│                                                      erp-alerts-service     │
│  COMUNICAÇÃO                                         erp-dashboard-service  │
│  erp-pdf-service.tsx                                 erp-vat-report-svc     │
│  erp-email-service.ts                                erp-reconciliation-svc │
│  erp-communication-service.ts                        erp-export-service     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                           EVENT BUS                                     │ │
│  │  event-bus.ts · publish(event, payload) · subscribe(event, handler)     │ │
│  │  Eventos: lead.*, company.*, erp.contract.*, erp.invoice.*, erp.pay.*  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                           CAMADA DE DADOS                                    │
│                                                                              │
│  PRISMA ORM (src/lib/prisma.ts)                                              │
│                                                                              │
│  DOMÍNIO LEGADO              DOMÍNIO CRM              DOMÍNIO ERP            │
│  Lead                        CrmContact               ErpContract            │
│  Company (pivot)             CrmDeal                  ErpRentSchedule        │
│  Reservation                 CrmActivity              ErpInvoice             │
│  Invoice (legado)            CrmTask                  ErpInvoiceItem         │
│  Payment (legado)            CrmNote                  ErpPayment             │
│  Expense (legado)            CrmTag                   FinancialLedger ¹      │
│  Plan                        CrmCompanyTag            ErpExpense             │
│  Room                        TimelineEntry            ExpenseCategory        │
│  Employee                    AuditLog                 CostCenter             │
│  AdminUser                                            CashMovement           │
│  DocumentCounter                                      FinancialAlert         │
│                                                       FinancialReportSnapshot│
│                                                                              │
│  ¹ Ledger Imutável (ADR-021): append-only, nunca UPDATE/DELETE              │
│                                                                              │
│  PostgreSQL (Neon Serverless) — prod: DATABASE_URL em .env                  │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                         SERVIÇOS EXTERNOS                                    │
│                                                                              │
│  Cloudinary (armazenamento)    nodemailer/SMTP (email)   Sentry (monitoring) │
│  /azul-cowork/erp/invoices/    SMTP_HOST + SMTP_USER     DSN configurável    │
│  /azul-cowork/erp/receipts/    graceful degradation      release tracking    │
│  /azul-cowork/images/          quando não configurado                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Princípios Arquitecturais Activos

### 3.1 Single Source of Truth (SSoT)

- `Company` é o pivot financeiro de toda a plataforma
- `FinancialLedger` é o SSoT para todos os saldos financeiros (soma de entradas, nunca campo calculado persistido)
- `DocumentCounter` é o SSoT para numeração de documentos
- `AdminRole` enum está no schema Prisma (uma única definição)

### 3.2 Event-Driven

Todos os módulos comunicam via Event Bus. Nenhum serviço chama directamente outro serviço
(excepto quando a operação é atómica dentro de `prisma.$transaction()`).

```
erp.invoice.issued  → handler: criar alerta de cobrança
erp.payment.confirmed → handler: resolver alerta + criar CashMovement
erp.contract.expiring → handler: criar alerta CONTRACT_EXPIRING
```

### 3.3 Transacções Obrigatórias

Toda operação que modifica > 1 tabela usa `prisma.$transaction()`. Sem excepções.

### 3.4 RBAC por Camada

```
Middleware (middleware.ts): protege /admin/* — requer sessão válida
API Route:                  requireRole() — verifica role específico
Frontend:                   componentes condicionais por role
```

### 3.5 Graceful Degradation

Serviços externos (Cloudinary, SMTP/email) degradam graciosamente:
- Se não configurados → operação core continua; warning registado em `warnings[]`
- PDF gerado mesmo sem Cloudinary (upload skipped)
- Lançamento contabilístico feito mesmo sem email enviado

---

## 4. Fluxo de Dados Crítico — Ciclo Financeiro Completo

```
1. CONTRATO CRIADO
   ErpContract (DRAFT) → activate() → ErpRentSchedules gerados (n parcelas mensais)

2. FATURA EMITIDA
   ErpRentSchedule (PENDING) → createErpInvoice() → ErpInvoice (DRAFT)
   issueErpInvoice() → ErpInvoice (ISSUED)
             → FinancialLedger: CREDIT 7111 (Proveitos)
             → publish("erp.invoice.issued")

3. ENVIO DA FATURA
   sendInvoice() → PDF gerado → upload Cloudinary → SMTP email
             → ErpInvoice (SENT, pdfUrl, sentAt, sentTo)
             → publish("erp.invoice.sent")

4. PAGAMENTO REGISTADO
   registerPayment() → ErpPayment (PENDING)

5. PAGAMENTO CONFIRMADO
   confirmPayment() → ErpPayment (CONFIRMED)
             → FinancialLedger: DEBIT 1201 (banco) + CREDIT 2111 (clientes a receber)
             → CashMovement (INFLOW, real)
             → REC-YYYY-NNNNNN gerado atomicamente
             → FinancialAlert PAYMENT_OVERDUE resolvido
             → publish("erp.payment.confirmed")

6. RELATÓRIO / SNAPSHOT MENSAL (cron 22h dia 28–31)
   generateMonthlySnapshot() → FinancialReportSnapshot upsert
```

---

## 5. Segurança — Inventário

| Mecanismo | Implementação | Estado |
|---|---|---|
| Autenticação | JWT `jose` (HS256) sem fallback | ✅ Activo |
| Sessão | Cookie `httpOnly; Secure; SameSite=Strict` | ✅ Activo |
| Autorização | `requireRole()` em todas as routes protegidas | ✅ Activo |
| 2FA | TOTP (RFC 6238) via `otplib` | ✅ Disponível (opt-in) |
| Rate Limiting | `rateLimit.ts` em routes de mutação | ✅ Activo |
| Input Validation | `validators.ts` + Zod schemas | ✅ Activo |
| TypeScript | Strict mode, zero `any` implícito | ✅ Activo |
| CSP | `next.config.js` Content-Security-Policy | ✅ Activo |
| Sentry | DSN configurável via env var | ⚠️ Config pronta, DSN pendente |

---

## 6. Decisões Arquitecturais (ADR Index)

| ADR | Decisão | Estado |
|---|---|---|
| ADR-001 | Next.js 15 com App Router | ACEITE |
| ADR-002 | Prisma como ORM principal | ACEITE |
| ADR-003 | JWT com jose (sem next-auth) | ACEITE |
| ADR-004 | Cloudinary para assets binários | ACEITE |
| ADR-005 | Event Bus interno (sem broker externo) | ACEITE |
| ADR-016 | Company como SSoT do CRM | ACEITE |
| ADR-017 | Pipeline State Machine explícita | ACEITE |
| ADR-018 | Timeline Universal por entidade | ACEITE |
| ADR-019 | Duplicate Detection automático | ACEITE |
| ADR-020 | Merge de empresas com auditoria | ACEITE |
| ADR-021 | FinancialLedger Imutável (append-only) | ACEITE |
| ADR-022 | ErpContract como entidade central de aluguer | ACEITE |
| ADR-023 | Separação Invoice / Payment / Ledger | ACEITE |
| ADR-024 | CostCenter como dimensão analítica plana | ACEITE |
| ADR-025 | CashFlow baseado em eventos (event-driven) | ACEITE |

---

## 7. Variáveis de Ambiente Obrigatórias

```bash
# Base de Dados
DATABASE_URL=                 # Neon PostgreSQL connection string

# Autenticação
JWT_SECRET=                   # Mínimo 32 caracteres, sem fallback

# Cloudinary (graceful degradation se ausentes)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email SMTP (graceful degradation se ausentes)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=                    # default: "Azul Coworking <geral@azulcowork.com>"

# Cron Jobs (autenticação via Bearer token)
CRON_SECRET=                  # Secret para /api/cron/*

# Sentry (opcional, monitorização de erros)
SENTRY_DSN=

# Cloudinary Upload Preset (frontend)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
```

---

*VD Platform — Arquitectura v1.0.0 — 29 Julho 2026*
