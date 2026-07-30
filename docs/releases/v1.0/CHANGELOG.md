# CHANGELOG — VD Platform v1.0.0

> **Release Candidate:** v1.0.0-rc.1  
> **Data:** 29 Julho 2026  
> **Operador:** Azul Coworking, Bairro Azul, Edifício 18, Luanda, Angola  
> **NIF Operador:** 5002174308  
> **Product Owner:** Ernesto Pinto Luciano

---

## Resumo Executivo

A versão v1.0.0 representa a primeira versão de produção completa do VD Platform, com dois volumes
de funcionalidade entregues: **CRM** (Volume 01) e **ERP Financeiro Integrado** (Volume 02).
A plataforma está operacional no Azul Coworking desde Julho de 2026.

---

## Volume 00 — Foundation & Estabilização (Fev–Abr 2026)

### Fase 00 — Foundation

- **Arquitectura:** Clean Architecture + DDD + Event-Driven implementados como padrão base
- **Stack definida:** Next.js 15 · TypeScript · Prisma 5.22 · PostgreSQL (Neon) · jose · Cloudinary
- **Documentação:** 11 documentos de fundação aprovados (product-vision, architecture, domain-model, technology-stack, principles, methodology, business-bible, ADRs 001–005, claude-guide, diagrams, roadmap, glossary)
- **Business Bible:** Regras de negócio BR-001 a BR-005 formalizadas
- **ADRs 001–005:** Decisões arquitecturais de base registadas e aceites

### Fase P0-A — Segurança Crítica

- **DT-011 RESOLVIDO:** Removido JWT fallback secret (`JWT_SECRET` obrigatório sem fallback)
- **DT-012 RESOLVIDO:** RBAC completo implementado via `requireRole()` com enum `AdminRole` (ADMIN | COMERCIAL | FINANCEIRO | VIEWER)
- `src/lib/auth.ts`: `requireSession()` + `requireRole(...roles)` com mensagens de erro padronizadas
- Enum `AdminRole` migrado para o schema Prisma (SSoT)
- Todas as routes admin protegidas com RBAC explícito

### Fase P0-B — Integridade de Dados

- **DT-013 RESOLVIDO:** TOCTOU no conflict check de reservas → SELECT com lock
- **DT-014 RESOLVIDO:** Numeração de documentos com `SELECT ... FOR UPDATE` (atomic counter)
- **DT-017 RESOLVIDO:** `recordFinancialHistory` movido para dentro do contexto `prisma.$transaction()`
- `src/lib/document-numbering.ts`: geração atómica de FT-SALA, FT-CWORK, REC, NL, RES com `DocumentCounter`

### Fase P0-C — Cobertura de Testes

- Framework de testes instalada: Vitest 4.1.10 + @vitest/coverage-v8
- Setup global: `src/__tests__/setup.ts` + mock do Prisma + fixtures
- 8 ficheiros de teste base criados (validators, finance, document-numbering, pricing-service, event-bus, rateLimit, auth, auth-smoke)
- Cobertura inicial atingida: ≥ 60% nos módulos críticos

### Fase P0-D — Qualidade e Observabilidade

- **DT-016 RESOLVIDO:** TOTP 2FA integrado no fluxo de login (`POST /api/admin/totp/setup` + `POST /api/auth/totp/verify`)
- **DT-010 RESOLVIDO:** Rate limiting aplicado a todas as routes de mutação crítica
- **DT-001 RESOLVIDO:** `ignoreBuildErrors: true` removido; TypeScript strict activo
- **DT-009:** Configuração Sentry preparada (activação dependente de DSN em produção)
- Quality Gate (Gate 1 + Gate 2) formalizado em `docs/p0-stabilization/quality-gate.md`
- Governance Framework completo: `docs/governance/README.md`
- Architecture Decision Log iniciado: `docs/adr/README.md`

---

## Volume 01 — CRM (Mai–Jun 2026)

### Especificação (Sprint CRM-0)

- 14 documentos de especificação CRM produzidos e aprovados
- Modelo de domínio CRM: Company como pivot, Contact, Deal, Activity, Task, Note, Tag
- Pipeline State Machine: LEAD → PROSPECT → QUALIFIED → PROPOSAL → NEGOTIATION → CLIENT / LOST
- ADRs 016–020 registados (Company como SSoT, Timeline Universal, etc.)
- CRM Event Catalog: 12 eventos de domínio

### Modelo de Dados (RFT-100 → RFT-101)

- 10 novas tabelas Prisma: `CrmContact`, `CrmDeal`, `CrmActivity`, `CrmTask`, `CrmNote`, `CrmTag`,
  `CrmCompanyTag`, `CrmDealStageHistory`, `TimelineEntry`, `AuditLog`
- Migration `crm-schema` aplicada em produção
- Migração de dados históricos: Leads + Companies existentes migrados para estrutura CRM

### APIs CRM (RFT-102 → RFT-109)

- `POST/GET /api/crm/companies` — criação com duplicate detection
- `GET/PATCH/DELETE /api/crm/companies/[id]` — Customer 360° completo
- `GET /api/crm/companies/[id]/timeline` — timeline cronológica
- `POST/GET /api/crm/companies/[id]/contacts` — gestão de contactos
- `GET/PUT/DELETE /api/crm/companies/[id]/contacts/[contactId]`
- `POST/GET /api/crm/companies/[id]/deals` — pipeline de negócios
- `PATCH/DELETE /api/crm/companies/[id]/deals/[dealId]`
- `POST /api/crm/companies/[id]/activities` — actividades comerciais
- `POST/GET /api/crm/companies/[id]/tasks` — tarefas
- `PATCH/DELETE /api/crm/companies/[id]/tasks/[taskId]`
- `GET /api/crm/tasks/my` — tarefas do utilizador corrente
- `POST/GET /api/crm/companies/[id]/notes` — notas
- `PUT/DELETE /api/crm/companies/[id]/notes/[noteId]`
- `POST/GET /api/crm/tags` — gestão de tags
- `PUT/DELETE /api/crm/tags/[tagId]`
- `POST/DELETE /api/crm/companies/[id]/tags/[tagId]` — associação tag/empresa
- `GET /api/crm/companies/check-duplicate` — detecção de duplicados
- `GET /api/crm/companies/duplicates` — lista de duplicados
- `POST /api/crm/companies/[id]/merge` — merge de empresas
- `GET /api/crm/dashboard` — KPIs CRM (pipeline, conversão, actividade)
- `GET /api/crm/pipeline` — Kanban por stage com totais
- `POST /api/crm/migrate-leads` — migração de leads históricos

### Frontend CRM (CRM-FE-1 → CRM-FE-7)

- `/admin/crm` — lista de empresas com filtros e pesquisa
- `/admin/crm/[id]` — Customer 360°: tabs de overview, contactos, deals, actividades, tarefas, notas, financeiro
- `/admin/crm/kanban` — Kanban comercial drag-and-drop por stage
- `/admin/crm/dashboard` — Dashboard CRM com KPIs e gráficos
- `/admin/crm/tarefas` — "As Minhas Tarefas" (COMERCIAL)
- Sidebar CRM com navegação entre secções

### Testes CRM

- `pipeline-state-machine.test.ts` — 50 testes (transições válidas e inválidas)
- `crm-validators.test.ts` — 45 testes (validação de input CRM)

---

## Volume 02 — ERP Financeiro Integrado (Jul 2026)

### Especificação (Sprint ERP-0)

- 26 documentos de especificação produzidos e aprovados antes de qualquer código
- Modelo de domínio financeiro completo: contratos, faturas, pagamentos, despesas, ledger, cashflow, alertas
- Plano de Contas Angola (PGC): contas 1xxx–7xxx mapeadas
- ADRs 021–025 registados (Ledger Imutável, Contract como SSoT, Separação Invoice/Payment/Ledger, CostCenter plano, CashFlow event-driven)

### Modelo de Dados (Sprint ERP-1)

- 15 novos enums ERP no schema Prisma
- 12 novos modelos: `ErpContract`, `ErpRentSchedule`, `ErpInvoice`, `ErpInvoiceItem`, `ErpPayment`,
  `FinancialLedger`, `ErpExpense`, `ExpenseCategory`, `CostCenter`, `CashMovement`,
  `FinancialAlert`, `FinancialReportSnapshot`
- Migration `erp-volume02` aplicada em produção (Neon)
- Seed: 9 CostCenters + 22 ExpenseCategories + DocumentCounters (FT-CWORK, NL, REC)
- Princípio: **Ledger Imutável** (append-only, ADR-021) — nunca UPDATE nem DELETE no FinancialLedger

### Contratos e Faturação (Sprints ERP-2A + ERP-2B)

- `erp-contract-service.ts`: create, activate (gera RentSchedules), suspend, reactivate, terminate
- `erp-billing-service.ts`: IVA 14% (Lei 17/19), createErpInvoice, issueErpInvoice (+ledger CREDIT 7111), voidErpInvoice (+estorno)
- Numeração atómica: `FT-CWORK-YYYY-NNNNNN`
- RBAC: ADMIN e FINANCEIRO em todas as operações financeiras
- 23 testes unitários (IVA engine + BR-CONT-001)

### Pagamentos e Recibos (Sprint ERP-3)

- `erp-payment-service.ts`: register, confirm, reject, refund
- Partida dupla na confirmação: DEBIT 1201 (banco) + CREDIT 2111 (clientes a receber)
- CashMovement INFLOW gerado automaticamente na confirmação
- Geração atómica de número de recibo `REC-YYYY-NNNNNN`
- Resolução automática de alertas `PAYMENT_OVERDUE` na confirmação
- 16 testes unitários

### Despesas e Centros de Custo (Sprint ERP-4)

- `erp-expense-service.ts`: create (PENDING), submit, approve, reject, pay, cancel
- Partida dupla no pagamento: DEBIT 6xxx (conta da categoria) + CREDIT 1201 (banco)
- CashMovement OUTFLOW gerado automaticamente no pagamento
- Aging Report AR: 0–30d / 31–60d / 61–90d / +90d por empresa
- Relatório AP: despesas pendentes por vencer / em atraso por CostCenter
- 34 testes unitários

### Fluxo de Caixa (Sprint ERP-5)

- `erp-cashflow-service.ts`: movimentos reais + projecções 30/60/90 dias
- Projecções: RentSchedules PENDING → INFLOW projectado; Expenses recorrentes → OUTFLOW projectado
- Saldo acumulado calculado sequencialmente
- KPIs de caixa: saldo actual, entrada/saída do mês, runway
- Ajuste manual de movimento com nota de justificação
- 23 testes unitários

### Alertas Automáticos (Sprint ERP-6)

- `erp-alerts-service.ts`: 7 tipos de alerta automático
- Cron diário `GET /api/cron/erp-daily`: CONTRACT_EXPIRING (60/30/7d), PAYMENT_OVERDUE, CONTRACT_EXPIRED
- Cron mensal: BUDGET_EXCEEDED por CostCenter
- Ciclo de vida: ACTIVE → ACKNOWLEDGED → RESOLVED / SNOOZED
- 38 testes unitários

### Dashboard Financeiro (Sprint ERP-7)

- `erp-dashboard-service.ts`: KPIs em tempo real, P&L, Trial Balance, MRR Breakdown
- MRR/ARR, churn rate, ticket médio, gross margin, EBIT, inadimplência %
- Trial Balance a partir do FinancialLedger (ADR-021): totalDebit === totalCredit verificado
- `FinancialReportSnapshot`: upsert atómico por `period + type` — cron `0 22 28-31 * *`
- 37 testes unitários

### Comunicação Financeira (Sprint ERP-8)

- `erp-pdf-service.tsx`: geração de PDF via `@react-pdf/renderer` v4
  - Fatura: NIF 5002174308, dados BCS (IBAN AO06007000000212870210113), tabela de itens, IVA 14%
  - Recibo: n.º REC-YYYY-NNNNNN, método de pagamento, valor em destaque
- `erp-email-service.ts`: 4 templates HTML responsivos via nodemailer (SMTP)
  - Invoice, Receipt, Reminder, Overdue (graceful degradation quando SMTP não configurado)
- `erp-communication-service.ts`: orquestrador PDF → Cloudinary → BD → Email → Evento
  - Upload Cloudinary `resource_type: "raw"` em `/azul-cowork/erp/{invoices|receipts}/YYYY/MM/`
- 33 testes unitários

### Relatórios e BI (Sprint ERP-9)

- `erp-vat-report-service.ts`: apuramento IVA Angola (conta 2311 / 2312)
  - `getVatReport(period?)` — apuramento mensal com linhas de detalhe
  - `getVatHistory(months)` — tendência histórica N meses
- `erp-reconciliation-service.ts`: reconciliação bancária CashMovement vs Payments/Expenses
  - Threshold: Kz 1.000 — discrepância acima → MISMATCH
- `erp-export-service.ts`: 6 tipos exportáveis XLSX/CSV via exceljs
  - P&L, AR Aging, MRR Breakdown, IVA, Cost Centers, Inadimplência
- 42 testes unitários

---

## Infraestrutura e Transversais

### Segurança

- JWT com `jose` (sem fallback secret); expiração 24h; `httpOnly; Secure; SameSite=Strict`
- RBAC em todas as routes (ADMIN | COMERCIAL | FINANCEIRO | VIEWER)
- TOTP 2FA disponível por utilizador (activação manual)
- Rate limiting em todas as routes de mutação crítica
- TypeScript strict sem `any` implícito
- CSP configurada em `next.config.js`
- Validação de input em todas as routes públicas via `validators.ts`

### Observabilidade

- Sentry configurado (activação por DSN em produção)
- Event Bus (`event-bus.ts`): publish/subscribe para todos os eventos de domínio
- AuditLog: registo de todas as operações sensíveis com actorId + payload
- Timeline Universal: `TimelineEntry` para todos os eventos de CRM e ERP

### Armazenamento

- PostgreSQL (Neon) — base de dados principal
- Cloudinary — armazenamento de ficheiros (PDFs, imagens) em `/azul-cowork/`
- Prisma 5.22.0 — ORM com migrations aplicadas em produção

---

## Contagem de Ficheiros Entregues

| Categoria | Ficheiros |
|---|---|
| Serviços de domínio (`src/lib/`) | 23 |
| API Routes (`src/app/api/`) | 123 |
| Ficheiros de teste (`src/__tests__/`) | 19 |
| Documentos (`docs/`) | 80+ |
| Schema Prisma (modelos) | 30 modelos |
| Migrações aplicadas | 3 (base, crm-schema, erp-volume02) |

---

## Dívidas Técnicas Resolvidas nesta versão

| ID | Dívida | Estado |
|---|---|---|
| DT-001 | TypeScript ignoreBuildErrors | ✅ Resolvido — P0-D |
| DT-010 | Rate limiting incompleto | ✅ Resolvido — P0-D |
| DT-011 | JWT fallback secret | ✅ Resolvido — P0-A |
| DT-012 | RBAC incompleto nas API Routes | ✅ Resolvido — P0-A |
| DT-013 | TOCTOU no conflict check de reservas | ✅ Resolvido — P0-B |
| DT-014 | Numeração de documentos com race condition | ✅ Resolvido — P0-B |
| DT-016 | TOTP 2FA sem integração no login | ✅ Resolvido — P0-D |
| DT-017 | recordFinancialHistory fora de contexto tx | ✅ Resolvido — P0-B |

## Dívidas Técnicas Pendentes (v1.1)

| ID | Dívida | Impacto | Target |
|---|---|---|---|
| DT-002 | Cobertura de testes abaixo de 80% | Médio | v1.1 |
| DT-009 | Sentry sem DSN activo em produção | Alto | v1.1 |

---

*VD Platform — CHANGELOG v1.0.0 — 29 Julho 2026*
