# Architecture Decision Records — VD Platform

> **Documento:** ADR-INDEX  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado  
> **Data:** Julho 2026  

---

## O que são ADRs?

Architecture Decision Records (ADRs) são documentos que registam **decisões arquitecturais significativas** tomadas durante o desenvolvimento de um sistema de software, incluindo o contexto, as alternativas consideradas e as razões da decisão.

Um ADR é criado quando:
- Uma nova tecnologia ou biblioteca é adoptada
- Um padrão arquitectural é definido ou alterado
- Uma decisão difícil de reverter é tomada
- Uma decisão que afecta múltiplos módulos é tomada
- Uma decisão que pode ser questionada no futuro é tomada

---

## Formato de um ADR

```markdown
# ADR-NNN — Título

**Estado:** [PROPOSTO / ACEITE / DEPRECIADO / SUBSTITUÍDO por ADR-XXX]
**Data:** YYYY-MM-DD
**Decisores:** [nomes]

## Contexto
O problema que motivou esta decisão.

## Decisão
A decisão tomada.

## Alternativas Consideradas
Outras opções e por que não foram escolhidas.

## Consequências
### Positivas
### Negativas (trade-offs)

## Revisão
Quando e como rever esta decisão.
```

---

## Índice de ADRs

| ID | Título | Estado | Data |
|---|---|---|---|
| [ADR-001](./ADR-001-nextjs-app-router.md) | Next.js 15 com App Router | ✅ ACEITE | 2026-07 |
| [ADR-002](./ADR-002-postgresql-prisma.md) | PostgreSQL via Prisma ORM | ✅ ACEITE | 2026-07 |
| [ADR-003](./ADR-003-event-driven-architecture.md) | Event-Driven Architecture com Event Bus | ✅ ACEITE | 2026-07 |
| [ADR-004](./ADR-004-jwt-authentication.md) | Autenticação JWT com jose | ✅ ACEITE | 2026-07 |
| [ADR-005](./ADR-005-clean-architecture-ddd.md) | Clean Architecture + DDD | ✅ ACEITE | 2026-07 |
| ADR-006 | Enum `AdminRole` para RBAC tipado | ✅ ACEITE | 2026-07 |
| ADR-007 | `DocumentCounter` com upsert atómico | ✅ APROVADO | 2026-07 |
| ADR-008 | Vitest como framework de testes (implementado: 128 testes, 91.8% cobertura) | ✅ ACEITE | 2026-07-27 |
| ADR-009 | Sentry para observabilidade e error monitoring | ✅ APROVADO | 2026-07 |
| ADR-010 | Fluxo TOTP em dois passos com JWT temporário | ✅ APROVADO | 2026-07 |
| ADR-011 | RBAC centralizado: `requireRole` / `requireSession` | ✅ ACEITE | 2026-07-27 |
| ADR-012 | Serializable isolation para conflict check de reservas | ✅ ACEITE | 2026-07-27 |
| ADR-013 | `DbClient` type para operações financeiras atómicas | ✅ ACEITE | 2026-07-27 |
| ADR-016 | Company como entidade central do CRM (SSoT) | 📝 PROPOSTO | 2026-07-28 |
| ADR-017 | Lead como estado de Company, não entidade independente | 📝 PROPOSTO | 2026-07-28 |
| ADR-018 | Timeline Global unificada via Event Bus (append-only) | 📝 PROPOSTO | 2026-07-28 |
| ADR-019 | Estratégia de merge de empresas duplicadas | 📝 PROPOSTO | 2026-07-28 |
| ADR-020 | Row-level filtering de Companies adiado para L3 | 📝 PROPOSTO | 2026-07-28 |
| ADR-021 | Ledger Financeiro Imutável (append-only) | 📝 PROPOSTO | 2026-07-28 |
| ADR-022 | Contract como entidade central de aluguer | 📝 PROPOSTO | 2026-07-28 |
| ADR-023 | Separação Invoice / Payment / FinancialLedger | 📝 PROPOSTO | 2026-07-28 |
| ADR-024 | CostCenter como dimensão analítica plana | 📝 PROPOSTO | 2026-07-28 |
| ADR-025 | CashFlow baseado em eventos (event-driven) | 📝 PROPOSTO | 2026-07-28 |
| [ADR-031](./ADR-031-reservation-state-machine.md) | State Machine Formal para Reservation.status | ✅ ACEITE | 2026-07-29 |
| [ADR-032](./ADR-032-serializable-conflict-check.md) | $transaction Serializable para Conflict Check (DT-013) | ✅ ACEITE | 2026-07-29 |
| [ADR-033](./ADR-033-post-commit-financial-history.md) | Post-Commit Pattern para recordFinancialHistory (DT-017) | ✅ ACEITE | 2026-07-29 |
| [ADR-034](./ADR-034-meetingplan-pricing-ssot.md) | MeetingPlan como SSoT de Preços; RoomPricing como Legado | ✅ ACEITE | 2026-07-29 |
| [ADR-035](./ADR-035-audit-log-session-management.md) | Audit Log Post-Commit + AdminSession com revogação individual | ✅ ACEITE | 2026-07-29 |
| [ADR-036](./ADR-036-bi-dashboard-architecture.md) | Arquitectura BI: Endpoints `/api/bi/`, Gráficos Client-Side, PDF via @react-pdf/renderer (VOL06) | ✅ ACEITE | 2026-07-29 |
| [ADR-037](./ADR-037-communication-architecture.md) | Arquitectura Comunicação: CommunicationLog, EmailTemplate DB, WhatsApp Deep-Link, Template Interpolator (VOL07) | ✅ ACEITE | 2026-07-30 |
| [ADR-038](./ADR-038-document-management-architecture.md) | PDF Imutável + SHA-256 + Upload-em-Transacção + URL Assinada + Versionamento Duplo (VOL08) | ✅ ACEITE | 2026-07-30 |
| [ADR-039](./ADR-039-portal-frontend-architecture.md) | Middleware Edge + PortalAuthContext + Light Theme + Magic Link Callback Flow (VOL09) | ✅ ACEITE | 2026-07-30 |
| [ADR-040](./ADR-040-automations-email-billing.md) | sendEmail() SSoT + Fire-and-forget em auth + $transaction sem aninhamento + Cron mensal faturação (VOL10) | ✅ ACEITE | 2026-07-30 |
| [ADR-041](./ADR-041-deployment-infrastructure.md) | vercel.json com 11 crons + .env.example SSoT + seed idempotente + prisma migrate deploy no build (VOL11) | ✅ ACEITE | 2026-07-30 |
| [ADR-042](./ADR-042-erp-admin-ui.md) | ERP Admin UI (client components) + build:prod fix + web-push dependency (VOL12) | ✅ ACEITE | 2026-07-30 |

---

## ADR-021 — Ledger Financeiro Imutável (Append-Only)

**Estado:** PROPOSTO · **Data:** 2026-07-28 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** Em sistemas financeiros, a rastreabilidade e a integridade dos dados são requisitos legais e auditáveis. Editar ou eliminar um lançamento financeiro pode mascarar erros, fraudes ou inconsistências. O sistema precisa de um registo financeiro confiável e imutável.

**Decisão:** A entidade `FinancialLedger` é **append-only**. Não existe operação de UPDATE ou DELETE sobre esta tabela. Correcções são feitas por estorno: criar um novo lançamento de sinal contrário com `reverses` a referenciar o lançamento original. O schema não tem campo `updatedAt`. A API não expõe endpoints de mutação do Ledger.

**Alternativas rejeitadas:**
- Ledger mutável com campo de estado — permite edição que obscurece o histórico real.
- Soft-delete via `deletedAt` — mesmo problema de ocultação de lançamentos.

**Consequências positivas:** Auditoria total e irreversível. Conformidade com boas práticas contabilísticas. Fácil reconciliação.

**Consequências negativas:** Erros de lançamento exigem estorno (lançamento extra), aumentando o volume de registos. Requer disciplina na validação antes de criar entradas.

**Revisão:** Rever se a legislação angolana exigir algum formato específico de Livro Razão.

---

## ADR-022 — Contract como Entidade Central de Aluguer

**Estado:** PROPOSTO · **Data:** 2026-07-28 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** Actualmente, o sistema usa `Company.planType` e `Company.rentAmount` para gerir o plano de coworking. Estes campos simples não suportam múltiplos contratos, datas de início/fim, renovações automáticas, caução ou reajustes. À medida que o Azul Coworking cresce, o modelo precisa de ser mais rico.

**Decisão:** Criar a entidade `Contract` como pivot das relações de aluguer. Uma `Company` pode ter múltiplos contratos ao longo do tempo (mas apenas um ACTIVE). `Contract` gera `RentSchedule[]` na activação, que por sua vez originam `Invoice[]` automaticamente.

**Alternativas rejeitadas:**
- Expandir `Company` com mais campos de contrato — viola SSoT e cria dependência directa entre módulos CRM e ERP.
- Tabela de contratos sem state machine — impossibilita automação e alertas.

**Consequências positivas:** Suporte a histórico de contratos. Renovações automáticas. Alertas de expiração. Reajustes de valor.

**Consequências negativas:** Migração necessária dos campos `Company.planType` / `Company.rentAmount` para `Contract` (coberta no `migration.md`).

---

## ADR-023 — Separação Invoice / Payment / FinancialLedger

**Estado:** PROPOSTO · **Data:** 2026-07-28 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** No sistema actual, Invoice e Payment são parcialmente fundidas. Num ERP real, estas são entidades distintas: uma fatura pode ter múltiplos pagamentos parciais; um pagamento deve gerar um lançamento no razão; o razão deve ser independente das entidades de negócio.

**Decisão:** Manter `Invoice`, `Payment` e `FinancialLedger` como entidades separadas e relacionadas por FK. Um `Payment.confirmed` dispara a criação de entradas no `FinancialLedger` (DEBIT e CREDIT). A fatura é o documento de negócio; o pagamento é o acto financeiro; o ledger é o registo contabilístico.

**Consequências positivas:** Pagamentos parciais suportados nativamente. Ledger independente e auditável. Separação clara de responsabilidades.

**Consequências negativas:** Mais entidades para gerir. Transacções `$transaction` mais complexas.

---

## ADR-024 — CostCenter como Dimensão Analítica Plana

**Estado:** PROPOSTO · **Data:** 2026-07-28 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** Sistemas ERP avançados suportam hierarquias de centros de custo (ex.: TI > Cloud > Vercel). Para o Azul Coworking no MVP, a complexidade hierárquica não é necessária e aumentaria o custo de desenvolvimento.

**Decisão:** `CostCenter` é uma estrutura plana (sem `parentId`). Cada despesa e item de fatura é atribuído directamente a um centro de custo. Hierarquias analíticas são adiadas para uma fase posterior (volume ≥ 05).

**Consequências positivas:** Implementação simples. Suficiente para as necessidades actuais.

**Consequências negativas:** Impossibilidade de análise hierárquica no MVP.

---

## ADR-025 — CashFlow Baseado em Eventos (Event-Driven)

**Estado:** PROPOSTO · **Data:** 2026-07-28 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** O fluxo de caixa pode ser calculado de duas formas: (A) agregando dados de Invoice e Expense em tempo real; (B) mantendo uma tabela `CashMovement` actualizada por eventos. A opção A é mais simples mas lenta para dashboards; a opção B é mais complexa mas permite projecções, reconciliação e análise histórica independente.

**Decisão:** Adoptar `CashMovement` como entidade dedicada, populada por handlers do Event Bus. Cada `erp.payment.confirmed` cria um `CashMovement INFLOW`; cada `erp.expense.paid` cria um `CashMovement OUTFLOW`. Movimentos projectados (`isProjected=true`) são criados por cron com base em RentSchedules e Expenses recorrentes.

**Consequências positivas:** Dashboard de caixa em tempo real sem queries complexas. Projecções nativas. Reconciliação bancária estruturada.

**Consequências negativas:** Dupla escrita (Payment + CashMovement). Risco de inconsistência se o handler falhar (mitigado por Event Bus com retry e `.catch(() => {})`).

---

## ADR-006 — Enum `AdminRole` para RBAC Tipado

**Estado:** ACEITE · **Data:** 2026-07-27 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** O campo `role` em `AdminUser` era um `String` livre — qualquer valor podia ser atribuído sem validação pelo compilador. O cast `(admin as any).role || "ADMIN"` introduzia uma vulnerabilidade de segurança crítica (DT-011/DT-012).

**Decisão:** Criar enum Prisma `AdminRole { ADMIN | COMERCIAL | FINANCEIRO | VIEWER }` com default `VIEWER`. Migration `add_admin_role_enum` aplicada em produção.

**Alternativas rejeitadas:** Manter `String` com validação em runtime — rejeita por não ser type-safe e por não impedir erros em compile time.

**Consequências positivas:** TypeScript garante em compile time que apenas roles válidas são atribuídas. Sem fallback `|| "ADMIN"` no login.

**Consequências negativas:** Migration requer `DROP DEFAULT` antes de alterar o tipo (contornado com SQL explícito na migration).

---

## ADR-011 — RBAC Centralizado: `requireRole` / `requireSession`

**Estado:** ACEITE · **Data:** 2026-07-27 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** Cada API Route implementava independentemente a lógica de autenticação com `getSession()` + verificação manual de role — padrão duplicado em 40+ ficheiros, inconsistente e difícil de auditar (DT-012).

**Decisão:** Centralizar em `src/lib/auth.ts` dois helpers: `requireSession()` (autenticação) e `requireRole(...roles)` (autenticação + autorização). Ambos retornam `AuthResult = { session, error: null } | { session: null, error: NextResponse }`. Padrão de uso: `const { error } = await requireRole(AdminRole.ADMIN); if (error) return error;`.

**Alternativas rejeitadas:**
- Middleware Next.js por rota — menos granular, dificulta roles por método HTTP
- HOF wrapper — adiciona complexidade sem benefício claro no App Router

**Consequências positivas:** Single source of truth para auth; zero `getSession` nas routes (130 handlers protegidos, 0 esquecidos); auditável com um único grep.

**Consequências negativas:** Nenhuma significativa. A função `getSession` permanece em `auth.ts` para uso interno pelos helpers.

---

## ADR-012 — Serializable Isolation para Conflict Check de Reservas

**Estado:** ACEITE · **Data:** 2026-07-27 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** O conflict check de reservas (`findFirst` por sobreposição de datetime) e a criação da reserva (`create`) executavam em operações separadas — TOCTOU clássico: dois requests concorrentes passavam ambos o check antes de qualquer criação (DT-013).

**Decisão:** Mover conflict check e `reservationNumber count` para dentro de `prisma.$transaction` com `isolationLevel: Prisma.TransactionIsolationLevel.Serializable`. Distinguir dois cenários de erro: `ReservationConflictError` (conflito de negócio detectado pelo check) e `PrismaClientKnownRequestError P2034` (serialization failure do PostgreSQL para requests verdadeiramente concorrentes).

**Alternativas rejeitadas:**
- Exclusion constraint PostgreSQL (`tsrange && exclusion`) — mais robusto mas requer migration de schema e extensão `btree_gist`. Reservado para DT-014 se o volume de concorrência justificar.
- Advisory locks (`pg_advisory_xact_lock`) — requer SQL raw; complexidade desnecessária para o volume actual.

**Consequências positivas:** Race condition eliminada sem alterações ao schema. O `reservationNumber count` dentro da tx serializable mitiga parcialmente DT-014.

**Consequências negativas:** Serializable isolation aumenta a probabilidade de rollback em alta concorrência (aceitável dado o volume actual de Azul Coworking). P2034 deve ser tratado no cliente com retry ou mensagem "Tente novamente".

---

## ADR-013 — `DbClient` Type para Operações Financeiras Atómicas

**Estado:** ACEITE · **Data:** 2026-07-27 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** `recordFinancialHistory` aceitava `PrismaClient` mas era chamada dentro de `$transaction` com o cliente de transacção `tx` — tipo incompatível, resolvido com cast `tx as Parameters<typeof recordFinancialHistory>[0]` (frágil, suprime erros de tipo). Os pagamentos criavam `payment` e `financialHistory` em operações separadas — sem atomicidade (DT-017).

**Decisão:** Exportar `DbClient = Omit<PrismaClient, "$connect"|"$disconnect"|"$on"|"$transaction"|"$use"|"$extends">` de `finance.ts`. Este tipo é compatível com o cliente de transacção Prisma sem cast. Envolver `payment.create + recordFinancialHistory` e `payment.update + recordFinancialHistory` em `$transaction` nos respectivos handlers.

**Alternativas rejeitadas:**
- `Prisma.TransactionClient` directamente — não exportado de forma estável em todas as versões do Prisma 5.
- Manter cast — suprime erros de tipo e cria dependência frágil na assinatura interna do Prisma.

**Consequências positivas:** Zero casts. `payment` e `financialHistory` são sempre atómicos — se um falha, o outro reverte. Tipo reutilizável para qualquer função que precise de aceitar `prisma` ou `tx`.

**Consequências negativas:** `DbClient` precisa de ser actualizado se o Prisma adicionar novos métodos ao deny list (improvável).

---

## Architecture Decision Log

> Índice cronológico de todas as decisões arquitecturais significativas.  
> **Regra:** Cada decisão difícil de reverter ou que afecta múltiplos módulos deve ter uma entrada aqui.  
> **Actualização:** Obrigatória sempre que um ADR é criado, aprovado, depreciado ou substituído.

| ID | Data | Decisão | Estado | Impacto |
|---|---|---|---|---|
| ADR-001 | 26/07/2026 | Next.js 15 com App Router como framework principal | ✅ Aceite | Alto |
| ADR-002 | 26/07/2026 | PostgreSQL via Prisma 5 como base de dados e ORM | ✅ Aceite | Alto |
| ADR-003 | 26/07/2026 | Event-Driven Architecture com Event Bus tipado em memória | ✅ Aceite | Muito Alto |
| ADR-004 | 26/07/2026 | Autenticação JWT com `jose` + cookies httpOnly + bcryptjs | ✅ Aceite | Muito Alto |
| ADR-005 | 26/07/2026 | Clean Architecture + DDD com Bounded Contexts | ✅ Aceite | Crítico |
| ADR-006 | 26/07/2026 | Enum `AdminRole` (ADMIN/COMERCIAL/FINANCEIRO/VIEWER) substituindo `string` | ✅ Aprovado | Alto |
| ADR-007 | 26/07/2026 | Modelo `DocumentCounter` com `prisma.upsert` para numeração atómica de documentos | ✅ Aprovado | Alto |
| ADR-008 | 27/07/2026 | Vitest + @vitest/coverage-v8 + aliases estáticos next/headers — 128 testes, 91.8% cobertura | ✅ Aceite | Alto |
| ADR-009 | 26/07/2026 | Sentry SDK para error monitoring e observabilidade em produção | ✅ Aprovado | Médio |
| ADR-010 | 26/07/2026 | Login TOTP em dois passos: JWT temporário (scope: "totp-verify", 5min) + endpoint `/verify` | ✅ Aprovado | Crítico |
| ADR-011 | 27/07/2026 | RBAC centralizado: `requireRole`/`requireSession` em `auth.ts`; `AuthResult` union type | ✅ Aceite | Crítico |
| ADR-012 | 27/07/2026 | Serializable isolation + `ReservationConflictError` para eliminar TOCTOU em reservas | ✅ Aceite | Alto |
| ADR-013 | 27/07/2026 | `DbClient` type: `Omit<PrismaClient, ITXDenyList>` para atomicidade de operações financeiras | ✅ Aceite | Alto |
| ADR-014 | 27/07/2026 | TOTP 2FA: JWT temporário scope `"totp-verify"` (5min) + `otpauth` library | ✅ Aceite | Crítico |
| ADR-015 | 27/07/2026 | Rate limiting extensível: lojas isoladas por domínio (`lead`, `login`, `api`, `totp`) | ✅ Aceite | Alto |
| ADR-031 | 29/07/2026 | State Machine Formal: VALID_TRANSITIONS + assertValidTransition + isCancellationFree | ✅ Aceite | Alto |
| ADR-032 | 29/07/2026 | $transaction Serializable para conflict check — elimina TOCTOU (DT-013) | ✅ Aceite | Crítico |
| ADR-033 | 29/07/2026 | Post-commit pattern para recordFinancialHistory — auditoria não bloqueia tx (DT-017) | ✅ Aceite | Crítico |
| ADR-034 | 29/07/2026 | MeetingPlan como SSoT de pricing; RoomPricing marcado LEGADO | ✅ Aceite | Médio |
| ADR-035 | 29/07/2026 | Audit Log Post-Commit + AdminSession com revogação individual (VOL05) | ✅ Aceite | Alto |
| ADR-040 | 30/07/2026 | sendEmail() SSoT + Fire-and-forget em auth + $transaction sem aninhamento + Cron mensal faturação (VOL10) | ✅ Aceite | Alto |
| ADR-041 | 30/07/2026 | vercel.json com 11 crons + .env.example SSoT + seed idempotente + prisma migrate deploy no build (VOL11) | ✅ Aceite | Crítico |

---

## ADR-001 — Next.js 15 com App Router

**Estado:** ✅ ACEITE  
**Data:** Julho 2026  

### Contexto
A plataforma precisa de um framework web que suporte rendering no servidor (SSR) para SEO da landing page, rendering de componentes no servidor (RSC) para performance do painel admin, e API Routes integradas para o backend — tudo numa única codebase TypeScript.

### Decisão
Adoptar **Next.js 15** com **App Router** como framework principal da plataforma.

### Alternativas Consideradas

| Alternativa | Vantagens | Desvantagens |
|---|---|---|
| Remix | SSR nativo, loaders/actions elegantes | Ecosistema menor, menos recursos sobre RSC |
| SvelteKit | Performance excepcional, syntax limpa | TypeScript experience inferior, menos bibliotecas React |
| Express + React SPA | Total controlo, separação clara | Sem SSR nativo, duas codebases, mais complexidade de deploy |
| Nuxt.js | Boa DX, SSR nativo | Vue, não React — curva de aprendizagem adicional |
| Astro | Excellent performance (islands) | Menos adequado para admin panels interactivos |

### Razões da Escolha
1. **React Server Components:** Permitem executar queries Prisma directamente em componentes server-side, eliminando camadas de API desnecessárias para leituras
2. **SSR/SSG:** A landing page `/` e `/salas` beneficiam de SSR para SEO sem configuração adicional
3. **App Router:** Colocação de API Routes próxima das páginas (`/app/api/`) torna o código organizado e coerente
4. **Ecosistema:** Maior ecosistema de bibliotecas React, mais recursos de aprendizagem
5. **Vercel:** Deploy de Next.js no Vercel é trivial e optimizado

### Consequências

**Positivas:**
- Zero configuração para SSR, SSG, API Routes
- Queries de leitura em Server Components sem overhead de HTTP
- Deploy automático no Vercel
- Type safety de ponta a ponta com TypeScript

**Negativas (trade-offs):**
- App Router tem curva de aprendizagem (`"use client"` vs server components)
- Bundle do servidor pode crescer com muitas dependências
- Debugging de RSC ainda menos maduro que CSR

### Revisão
Rever se: Next.js introduzir breaking changes significativos, ou se a plataforma migrar para micro-serviços que tornem um monolito Next.js inadequado.

---

## ADR-002 — PostgreSQL via Prisma ORM

**Estado:** ✅ ACEITE  
**Data:** Julho 2026  

### Contexto
A plataforma precisa de uma base de dados que suporte: relações complexas entre entidades (Lead → Company → Payment → Invoice), transacções ACID para operações financeiras, escalabilidade para milhares de registos, e um ORM com type safety para TypeScript.

### Decisão
Adoptar **PostgreSQL** como base de dados relacional e **Prisma 5** como ORM.

**Fornecedor em produção:** Supabase (PostgreSQL gerido com backup automático e replica)  
**Desenvolvimento local:** SQLite (zero configuração) → evoluir para PostgreSQL local

### Alternativas de Base de Dados

| Alternativa | Vantagens | Desvantagens |
|---|---|---|
| MySQL | Amplo suporte, familiar | Menos features que PostgreSQL (JSON, arrays, etc.) |
| MongoDB | Flexibilidade de schema | Sem ACID nativo para múltiplas colecções; relações menos naturais |
| SQLite (produção) | Zero configuração | Sem concorrência adequada, sem replicação |
| PlanetScale | MySQL gerido, branching | MySQL limitations, custo |

### Alternativas de ORM

| Alternativa | Vantagens | Desvantagens |
|---|---|---|
| Drizzle ORM | Mais próximo de SQL, alta performance | Menos features, migrations menos maduras |
| TypeORM | Maduro, decorators | Menos type-safe, complexo para Next.js |
| Sequelize | Muito maduro | JavaScript-first, TS menos natural |
| SQL raw (node-postgres) | Performance máxima | Sem type safety, mais boilerplate |
| Kysely | Type-safe SQL builder | Menos abstração, mais verboso |

### Razões da Escolha

**PostgreSQL:**
1. ACID completo — crítico para integridade financeira
2. JSON nativo, arrays, full-text search — funcionalidades futuras
3. Índices avançados (parciais, compostos, GIN)
4. Supabase oferece PostgreSQL gerido gratuito na tier inicial

**Prisma:**
1. Type safety end-to-end — gera tipos TypeScript do schema
2. Migrations declarativas — schema.prisma como source of truth do DB
3. Prisma Studio — GUI para explorar dados em desenvolvimento
4. `$transaction()` — suporte nativo a transacções atómicas
5. Maior comunidade e recursos que Drizzle para o nível de maturidade do projecto

### Consequências

**Positivas:**
- Erros de tipo em queries detectados em compile-time
- Migrations geridas automaticamente
- Relacionamentos expressos de forma natural no schema

**Negativas (trade-offs):**
- Overhead de Prisma vs SQL raw (aceitável na escala actual)
- Prisma pode não suportar features PostgreSQL avançadas directamente → usar `$queryRaw` quando necessário
- SQLite em dev ≠ PostgreSQL em produção → risco de comportamentos diferentes

### Revisão
Rever se: o overhead do Prisma se tornar um bottleneck de performance (migrar para Drizzle ou Kysely), ou se precisarmos de features muito específicas do PostgreSQL não suportadas pelo Prisma.

---

## ADR-003 — Event-Driven Architecture com Event Bus em Memória

**Estado:** ✅ ACEITE  
**Data:** Julho 2026  

### Contexto
Os módulos do VD Platform precisam de comunicar entre si quando eventos de negócio ocorrem (lead criado → notificação, pagamento recebido → actualizar factura + histórico + timeline). Sem um mecanismo de comunicação desacoplado, os serviços ficam fortemente acoplados, tornando difícil adicionar novos comportamentos.

### Decisão
Implementar um **Event Bus tipado em memória** (`src/lib/event-bus.ts`) com interface `publish/subscribe`, mantendo a mesma interface que o Upstash Redis Pub/Sub para migração futura transparente.

### Alternativas Consideradas

| Alternativa | Vantagens | Desvantagens |
|---|---|---|
| Chamadas directas entre módulos | Simples de implementar | Acoplamento forte, difícil de testar, difícil de estender |
| Redis Pub/Sub (agora) | Persistência, multi-instância | Overhead de infraestrutura desnecessário na fase actual |
| Kafka / RabbitMQ | Escala massiva, persistência | Complexidade excessiva para a escala actual (YAGNI) |
| BullMQ (job queue) | Jobs persistentes, retry | Requer Redis, mais complexidade |
| Next.js Server Actions | Elegante para mutations | Não resolve comunicação entre módulos |

### Razões da Escolha
1. **Zero infraestrutura extra** na fase actual
2. **Interface idêntica ao Redis** — migração transparente quando necessário
3. **Type safety total** — cada evento tem o seu tipo TypeScript
4. **Isolamento de erros** — um handler com erro não afecta os outros
5. **Suficiente para single-instance** (Vercel single region)

### Limitações Conhecidas e Mitigação

| Limitação | Impacto | Mitigação |
|---|---|---|
| Sem persistência de eventos | Em caso de restart, eventos em processamento são perdidos | Aceitável: operações críticas são dentro de `$transaction` |
| Single-instance | Não funciona com múltiplos pods | Migrar para Upstash Redis em Fase 2 |
| Sem retry automático | Handler que falha → comportamento perdido | Handlers devem ser idempotentes; log de erro |

### Interface Estável (Não Modificar)

```typescript
// Esta interface NUNCA deve mudar — é o contrato de migração para Redis
export function publish<T extends AppEventName>(event: T, payload: AppEventPayload<T>): Promise<void>
export function subscribe<T extends AppEventName>(event: T, handler: Handler<T>): () => void
```

### Consequências

**Positivas:**
- Módulos desacoplados — adicionar um handler não altera o publicador
- Fácil de testar (mock do publish)
- Sem infraestrutura adicional necessária

**Negativas (trade-offs):**
- Eventos em memória não sobrevivem a restarts do servidor
- Debugging de fluxos de eventos requer logging adicional

### Revisão
Implementar Upstash Redis quando: múltiplas instâncias do servidor, ou quando a perda de eventos em caso de restart se tornar inaceitável.

---

## ADR-004 — Autenticação JWT com jose

**Estado:** ✅ ACEITE  
**Data:** Julho 2026  

### Contexto
O painel admin precisa de autenticação segura com suporte a RBAC. A solução deve ser stateless (sem sessões em BD), segura contra XSS (cookies httpOnly), e compatível com Vercel Edge Runtime.

### Decisão
Usar **jose** para JWT (geração e verificação) com cookies **httpOnly/secure/sameSite=lax**, e **bcryptjs** para hash de passwords.

### Alternativas Consideradas

| Alternativa | Vantagens | Desvantagens |
|---|---|---|
| NextAuth.js / Auth.js | Configuração zero para OAuth | Muito opinionado para RBAC customizado; overhead |
| Clerk | Excelente DX, UI pré-construída | SaaS externo, dados fora do controlo, custo mensal |
| Supabase Auth | Integrado com o DB | Acoplamento ao fornecedor, limita portabilidade |
| Iron Session | Simples, cookies encriptados | Menos flexível para payloads de sessão customizados |
| jsonwebtoken | Muito popular | Não compatível com Edge Runtime (usa módulos Node.js nativos) |

### Razões da Escolha

**jose:**
- 100% compatível com Web Crypto API → funciona no Vercel Edge
- Suporte a HS256, RS256, ES256
- Sem dependências nativas — instala em qualquer ambiente

**bcryptjs:**
- JavaScript puro → Edge compatible
- API idêntica ao `bcrypt` nativo — migração fácil se necessário

**Implementação própria vs bibliotecas de auth:**
- O RBAC do VD Platform é específico (ADMIN, COMERCIAL, FINANCEIRO, VIEWER)
- Customizações como TOTP são mais simples de implementar directamente
- Mantemos controlo total sobre o fluxo de auth

### Configuração de Segurança

```typescript
// Cookie com máxima segurança
{
  httpOnly: true,        // XSS protection
  secure: true,          // HTTPS only (produção)
  sameSite: "lax",       // CSRF protection
  path: "/",
  maxAge: 60 * 60 * 12  // 12 horas
}
```

### Consequências

**Positivas:**
- Stateless → escala horizontalmente sem sessões centralizadas
- Sem XSS access ao cookie (httpOnly)
- CSRF mitigado por sameSite=lax
- Compatível com Vercel Edge Runtime

**Negativas (trade-offs):**
- Sessões não podem ser invalidadas imediatamente (apenas expirar)
- Renovação de token requer implementação adicional
- Sem "remember me" por enquanto (12h fixas)

### Revisão
Adicionar refresh tokens se a expiração de 12h se tornar um problema operacional. Adicionar blacklist de tokens em Redis se invalidação imediata for necessária.

---

## ADR-005 — Clean Architecture + Domain-Driven Design

**Estado:** ✅ ACEITE  
**Data:** Julho 2026  

### Contexto
A plataforma vai crescer significativamente em complexidade. Sem uma arquitectura bem definida, o código vai tornar-se difícil de manter, testar e evoluir. A escolha arquitectural deve suportar a adição de novos módulos sem "big bang rewrites".

### Decisão
Adoptar **Clean Architecture** (Robert C. Martin) combinada com princípios de **Domain-Driven Design (DDD)**, adaptados ao contexto de uma aplicação Next.js monolítica.

### Adaptações ao Contexto Next.js

A Clean Architecture pura assume uma separação de camadas em directórios distintos e injecção de dependências formal. No contexto Next.js, adoptamos uma versão pragmática:

| Camada Pura | Adaptação Next.js |
|---|---|
| Entities / Domain | Tipos TypeScript + Prisma types + Business Bible |
| Use Cases / Application | `src/lib/*-service.ts` |
| Interface Adapters | `src/app/api/**/*.ts` (Route Handlers) |
| Frameworks & Drivers | Next.js + Prisma + Cloudinary + Nodemailer |

**Excepção pragmática:** Server Components fazem queries Prisma directamente (violação estrita da Clean Architecture) porque é o padrão idiomático do Next.js e tem benefícios claros de DX e performance. Esta excepção aplica-se apenas a **leituras** — **escritas** passam sempre pelos services.

### Alternativas Consideradas

| Alternativa | Por que não |
|---|---|
| MVC simples | Não escala para a complexidade do VD Platform |
| Hexagonal Architecture | Mais formal, difícil de adoptar gradualmente |
| Feature-based (vertical slices) | Útil mas não resolve o problema de coesão entre módulos |
| Sem arquitectura definida | O caos actual, inaceitável para um produto de longo prazo |

### Bounded Contexts Adoptados

1. CRM Context — Lead, Note
2. Cowork Context — Company, Employee
3. Financial Context — Invoice, Payment, LiquidationNote, FinancialHistory, FinancialAudit
4. Reservation Context — Reservation, MeetingPlan, RoomPricing, RoomSettings
5. Security Context — AdminUser, DeleteRequest
6. Communication Context — Notification, Email, WhatsApp

### Consequências

**Positivas:**
- Módulos com fronteiras claras → fácil de adicionar funcionalidades sem efeitos colaterais
- Lógica de negócio nos services → testável de forma isolada
- Linguagem ubíqua → menos ambiguidade entre negócio e tecnologia
- Event Bus → desacoplamento total entre contextos

**Negativas (trade-offs):**
- Mais código de "setup" vs abordagens mais simples
- Curva de aprendizagem para novos elementos da equipa
- Tentação de contornar a arquitectura "para ser mais rápido"

### Regra de Ouro
> *Quando em dúvida sobre onde colocar um pedaço de código, pergunte: "De quem é esta responsabilidade?" A resposta determina a camada e o módulo.*

### Revisão
Rever quando: a plataforma crescer para micro-serviços (Clean Architecture mantém-se mas cada serviço tem a sua própria codebase), ou quando os Bounded Contexts precisarem de ser redistribuídos.

---

---

## ADR-006 — Enum `AdminRole` para RBAC Tipado

**Estado:** ✅ APROVADO  
**Data:** Julho 2026  
**Contexto:** Sprint P0-A — Segurança Imediata

### Contexto
O campo `role` do modelo `AdminUser` é uma `String` no schema Prisma. Isto significa que qualquer valor pode ser persistido, o TypeScript não detecta roles inválidas em compile-time, e os comparadores `=== "ADMIN"` espalhados pelo código são frágeis a typos. A auditoria identificou que o endpoint `/api/admin/users` cria roles com `role === "ADMIN" ? "ADMIN" : "USER"` — os valores COMERCIAL, FINANCEIRO e VIEWER nunca são atribuídos.

### Decisão
Substituir `String` por **enum `AdminRole`** no schema Prisma:

```prisma
enum AdminRole {
  ADMIN
  COMERCIAL
  FINANCEIRO
  VIEWER
}
```

E actualizar o modelo `AdminUser` para `role AdminRole @default(VIEWER)`.

### Consequências

**Positivas:**
- Roles inválidas detectadas em compile-time (TypeScript + Prisma)
- Comparadores `role === AdminRole.ADMIN` são refactor-safe
- Schema é a documentação live dos roles existentes

**Negativas (trade-offs):**
- Migration necessária — todos os valores `String` existentes devem ser mapeados para o enum
- Breaking change no tipo do campo `role` nas interfaces TypeScript existentes

### Revisão
Rever quando novos roles forem necessários (adicionar ao enum + nova migration).

---

## ADR-007 — `DocumentCounter` com Upsert Atómico

**Estado:** ✅ APROVADO  
**Data:** Julho 2026  
**Contexto:** Sprint P0-B — Integridade de Dados

### Contexto
A geração de números sequenciais de documentos financeiros (FT-SALA, FT-CWORK, REC, NL, RES) usa o padrão `count() + 1`. Este padrão tem uma race condition crítica: duas operações concorrentes podem executar `count()` simultaneamente, obter o mesmo valor, e gerar números de documento duplicados. Duplicados em documentos financeiros violam requisitos legais e de auditoria.

### Decisão
Introduzir o modelo `DocumentCounter` com incremento atómico via `prisma.$executeRaw`:

```prisma
model DocumentCounter {
  id        String   @id  // ex: "FT-SALA-2026"
  lastValue Int      @default(0)
  updatedAt DateTime @updatedAt
}
```

Função `getNextDocumentNumber(prefix, year)` usa `UPDATE ... SET lastValue = lastValue + 1 RETURNING lastValue` — operação atómica no PostgreSQL, sem race condition.

### Consequências

**Positivas:**
- Impossibilidade de números duplicados (garantia de BD)
- Funciona correctamente com N instâncias concorrentes
- Compatível com SQLite em dev (via `prisma.$transaction` com lock)

**Negativas (trade-offs):**
- Nova tabela na BD (migration necessária)
- `$executeRaw` perde type safety — compensado com função wrapper tipada
- Contadores persistem entre ambientes se a BD for partilhada

### Revisão
Rever se o PostgreSQL for substituído por uma BD sem suporte a `SELECT ... FOR UPDATE`.

---

## ADR-008 — Vitest como Framework de Testes

**Estado:** ✅ ACEITE — Implementado  
**Data:** 2026-07-27  
**Contexto:** Sprint P0-C — Infraestrutura de Testes (DT-002)

### Contexto
A plataforma não tinha testes unitários (DT-002 — Crítico). Era necessário escolher um framework de testes compatível com o stack (Next.js 15, TypeScript, ESM, Prisma) que minimizasse configuração e fosse rápido de adoptar. Desafio adicional: `next/headers` importa `workAsyncStorage` do runtime App Router do Next.js — módulo que está suspenso quando executado fora de um request context (como no Vitest), causando hang indefinido nos testes.

### Decisão
Adoptar **Vitest 4.1.10** com coverage provider **@vitest/coverage-v8** como framework de testes unitários, com **aliases estáticos** para módulos incompatíveis do Next.js.

### Alternativas Consideradas

| Alternativa | Por que não |
|---|---|
| Jest | Configuração complexa com ESM + Next.js 15; módulos `async_hooks` conflituam |
| Playwright | Testes E2E — adequado para fase posterior (P1+) |
| Testing Library only | Não cobre testes unitários de services |
| Mocha + Chai | Ecosistema mais antigo, menos integração TypeScript nativa |

### Razões da Escolha
- Compatibilidade nativa com ESM e TypeScript — zero config adicional
- API idêntica ao Jest — migração trivial e curva de aprendizagem baixa
- `vi.mock()` para mocks — essencial para isolar Prisma e jose
- Coverage provider v8 — sem dependências externas adicionais além do pacote
- Muito mais rápido que Jest em projecto Next.js

### Configuração Implementada

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // next/headers usa workAsyncStorage do runtime Next.js — hang em Vitest
      // Substituídos por mocks estáticos em src/__tests__/helpers/next-mocks/
      "next/headers": path.resolve(__dirname, "src/__tests__/helpers/next-mocks/headers.ts"),
      "next/server":  path.resolve(__dirname, "src/__tests__/helpers/next-mocks/server.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/validators.ts", "src/lib/rateLimit.ts", "src/lib/finance.ts",
                "src/lib/pricing-service.ts", "src/lib/event-bus.ts",
                "src/lib/document-numbering.ts", "src/lib/auth.ts"],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
    testTimeout: 5000,
  },
});
```

### Resultado da Implementação (2026-07-27)

**128/128 testes passam. 0 falhas. 0 testes instáveis.**

| Módulo | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `validators.ts` | 100% | 100% | 100% | 100% |
| `rateLimit.ts` | 100% | 100% | 100% | 100% |
| `pricing-service.ts` | 100% | 100% | 100% | 100% |
| `document-numbering.ts` | 100% | 100% | 100% | 100% |
| `event-bus.ts` | 96.7% | 92.9% | 90.9% | 96.6% |
| `auth.ts` | 84.6% | 92.9% | 66.7% | 84.0% |
| `finance.ts` | 80.0% | 47.6% | 92.9% | 78.8% |
| **TOTAL** | **91.8%** | **85.7%** | **91.5%** | **91.5%** |

**Gaps conhecidos e aceites:**
- `auth.ts`: `createSession`/`destroySession` (linhas 21-37) requerem runtime Next.js com cookies reais
- `finance.ts`: `recordFinancialHistory` (linhas 117-133) requer mock de `aggregate()` — agendado para P0-D

### Decisão Auxiliar: Aliases Estáticos para next/headers e next/server

O módulo `next/headers` não pode ser importado directamente em Vitest porque `workAsyncStorage` (interno do App Router) fica suspenso sem request context. A solução é redireccioná-lo via `resolve.alias` para mocks estáticos em `src/__tests__/helpers/next-mocks/`. O `vi.mock("next/headers")` no ficheiro de teste não resolve o problema porque o alias de resolução ocorre antes da intercepção do mock.

### Consequências

**Positivas:**
- `npm test` executa suite completa em < 5s
- 91.8% cobertura global nos módulos críticos (target: 60%)
- Mocks de Prisma com factory `createPrismaMock()` reutilizável
- Pattern estabelecido para todos os testes futuros

**Negativas (trade-offs):**
- Vitest não cobre testes de componentes React (Testing Library — fase posterior)
- Aliases estáticos para `next/headers` e `next/server` devem ser mantidos actualizados se a API desses módulos mudar

### Revisão
Adicionar `@testing-library/react` para testes de componentes UI quando necessário (P1+). Adicionar teste de `recordFinancialHistory` em P0-D.

---

## ADR-009 — Sentry para Observabilidade e Error Monitoring

**Estado:** ✅ APROVADO  
**Data:** Julho 2026  
**Contexto:** Sprint P0-D — Observabilidade

### Contexto
A plataforma não tem error monitoring em produção (DT-009 — Alto). Erros em produção são invisíveis até que um utilizador reporte. Sem traces de stack e contexto de utilizador, o diagnóstico é cego.

### Decisão
Integrar **Sentry** para error monitoring, com SDK `@sentry/nextjs`.

### Alternativas Consideradas

| Alternativa | Por que não |
|---|---|
| Datadog | Custo elevado para a fase actual |
| New Relic | Idem |
| Rollbar | Menos ecosistema Next.js |
| Logs manuais apenas | Sem alertas em tempo real, sem grouping |

### Razões da Escolha
- SDK oficial Next.js — instrumentação automática de API Routes e RSC
- Free tier suficiente para o volume actual
- Alertas de regressão em tempo real
- Source maps para stack traces legíveis

### Configuração Adoptada
- `sentry.client.config.ts` + `sentry.server.config.ts`
- `withSentryConfig` em `next.config.js`
- DSN em variável de ambiente `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` para upload de source maps

### Consequências

**Positivas:**
- Visibilidade imediata de erros em produção
- Agrupamento de erros similares
- Context de utilizador nos reports (sem PII sensível)

**Negativas (trade-offs):**
- Dependência de serviço externo
- Source maps enviados ao Sentry (risco de exposição de código — mitigado com `hideSourceMaps: true` em produção)
- Overhead mínimo por request instrumentado

### Revisão
Avaliar upgrade de plano se o volume de eventos ultrapassar o free tier.

---

## ADR-010 — Login TOTP em Dois Passos com JWT Temporário

**Estado:** ✅ APROVADO  
**Data:** Julho 2026  
**Contexto:** Sprint P0-D — 2FA TOTP

### Contexto
O schema Prisma tem os campos `totpSecret` e `totpEnabled` no modelo `AdminUser`, mas o endpoint `/api/auth/login` não os verifica (SEC-003 — Crítico). O TOTP está implementado na BD mas não no fluxo de autenticação — um utilizador com `totpEnabled: true` consegue autenticar-se sem código TOTP.

### Decisão
Implementar um fluxo de autenticação em dois passos:

**Passo 1** — `POST /api/auth/login` (credentials)
- Valida email + password (comportamento actual)
- Se `totpEnabled: true` → emite JWT temporário (`scope: "totp-verify"`, 5min) → responde `{ requireTotp: true }`
- Se `totpEnabled: false` → comportamento actual (emite sessão completa)

**Passo 2** — `POST /api/auth/totp/verify`
- Valida JWT temporário
- Valida código TOTP com `speakeasy`
- Se válido → emite JWT de sessão completa
- Se inválido → 401 sem revelar qual passo falhou

### Razões da Escolha
- JWT temporário evita estado de servidor (stateless)
- Scope `"totp-verify"` garante que o token temporário não pode ser usado como sessão
- 5 minutos é suficiente para o utilizador inserir o código sem criar janela de ataque significativa

### Consequências

**Positivas:**
- 2FA verdadeiro — password comprometida não é suficiente para acesso
- Stateless — sem tabela de "pending MFA" em BD
- Compatível com qualquer app TOTP (Google Authenticator, Authy, etc.)

**Negativas (trade-offs):**
- Dois round-trips para login com TOTP (UX aceitável)
- Sem backup codes implementados — utilizador sem acesso ao app TOTP fica bloqueado (fase posterior)
- Requer gestão de `totpSecret` encriptado em repouso (a definir)

### Revisão
Adicionar backup codes de recuperação e gestão de dispositivos confiáveis em fase posterior.

---

---

## ADR-014 — TOTP 2FA com JWT Temporário e `otpauth`

**Estado:** ✅ ACEITE · **Data:** 2026-07-27 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** Os campos `totpSecret` e `totpEnabled` existem no schema `AdminUser` desde o início, mas o login não os verificava (SEC-003 — Crítico). Um utilizador com TOTP activado conseguia autenticar sem código 2FA.

**Decisão:** Implementar fluxo em dois passos conforme ADR-010:
1. `POST /api/auth/login` — após password válida e `totpEnabled: true`, emite JWT temporário (`scope: "totp-verify"`, 5 minutos) e retorna `{ requireTotp: true, tempToken }` SEM criar sessão.
2. `POST /api/auth/totp/verify` — verifica o JWT temporário + código TOTP via `otpauth.TOTP.validate({ window: 1 })` → cria sessão completa. Rate limited a 5 tentativas/5 minutos.
3. `GET/POST/DELETE /api/admin/totp/setup` — gestão do secret TOTP pelo utilizador autenticado.

**Biblioteca escolhida:** `otpauth ^9.3.6` — ESM nativo, sem dependências nativas, compatível com Edge Runtime. Alternativa `speakeasy` rejeitada por depender de módulos Node.js nativos incompatíveis com Vercel Edge.

**Consequências positivas:** SEC-003 eliminado. Stateless (sem tabela de sessões pendentes). Compatível com Google Authenticator, Authy, etc.

**Consequências negativas:** Sem backup codes ainda — utilizador sem acesso ao app TOTP fica bloqueado (adicionar em Vol 01+). Dois round-trips para login com 2FA.

---

## ADR-015 — Rate Limiting Extensível com Lojas Isoladas por Domínio

**Estado:** ✅ ACEITE · **Data:** 2026-07-27 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** O rate limiting existente cobria apenas o formulário público de leads e o endpoint de login. API Routes de mutação críticas (payments, invoices, admin/users, totp/verify) estavam sem protecção (DT-010).

**Decisão:** Expandir `src/lib/rateLimit.ts` com:
- `isApiRateLimited(ip, key)` — 60 pedidos/minuto, namespace por endpoint (`payments`, `invoices`, `admin-users`)
- `isTotpRateLimited(ip)` — 5 tentativas/5 minutos (previne brute-force de códigos 6 dígitos)
- Lojas independentes (`apiStore`, `totpStore`) para evitar interferência entre domínios

**Alternativas rejeitadas:**
- Redis/Upstash agora — overhead de infraestrutura desnecessário; a interface pública permanece idêntica para migração futura transparente.
- Middleware Next.js global — menos granular, dificulta limites diferentes por endpoint.

**Consequências positivas:** Protecção imediata sem nova infraestrutura. Interface estável para migração futura a Redis.

**Consequências negativas:** In-memory não persiste entre restarts; não funciona com múltiplas instâncias (Vercel single-region — aceitável).

---

---

## ADR-016 — Company como Entidade Central do CRM (SSoT)

**Estado:** 📝 PROPOSTO · **Data:** 2026-07-28 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** O sistema actual tem a entidade `Lead` como entidade autónoma. Esta abordagem cria fragmentação: um "lead" que se converte em cliente duplica dados, perde historial e quebra a rastreabilidade. O Product Owner definiu explicitamente que "toda comunicação fica associada à Empresa" e que "todo fluxo deve ser reversível e rastreável."

**Decisão:** A entidade `Company` é a raiz de toda a hierarquia do CRM. `Lead` deixa de ser uma entidade separada e passa a ser um estado (`pipelineStage: NEW_LEAD`) de uma Company. Todas as entidades dependentes (Contact, Deal, Activity, Task, Note, Timeline) têm FK obrigatória para `Company`.

**Alternativas rejeitadas:**
- Manter `Lead` como entidade separada com join para `Company` — rejeita por criar duplicação e perda de historial na conversão.
- Entidade `Person` como centro (estilo HubSpot) — rejeita porque no contexto B2B do Azul Coworking, a Company é o cliente, não o indivíduo.

**Consequências positivas:** Zero duplicação de dados na conversão lead→cliente; historial completo e rastreável; Customer 360° real; SSoT garantido.

**Consequências negativas:** Migration necessária dos dados existentes (ver `migration.md`); maior complexidade inicial do schema vs. tabela `Lead` simples.

**Revisão:** Rever se o produto evoluir para B2C ou se surgir necessidade de gestão de pessoas independente de empresas (improvável no contexto actual).

---

## ADR-017 — Lead como Estado de Company, não Entidade Independente

**Estado:** 📝 PROPOSTO · **Data:** 2026-07-28 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** (Complementar ao ADR-016.) A questão concreta é: como implementar o conceito de "lead" sem criar uma tabela separada?

**Decisão:** `pipelineStage: PipelineStage` na tabela `companies` representa a posição de cada empresa no funil comercial. O valor `NEW_LEAD` é o estado inicial de qualquer empresa que entre no sistema como potencial cliente. A tabela `deals` regista oportunidades comerciais específicas, com o seu próprio ciclo de vida. A tabela `leads` existente é mantida em modo read-only durante a migração e deprecated após validação completa.

**Consequências positivas:** Modelo mais simples; sem joins entre `Lead` e `Company`; re-engagement trivial (basta mudar o stage de volta a `NEW_LEAD`).

**Consequências negativas:** Conceito menos familiar para utilizadores habituados a ferramentas como Salesforce onde Lead e Contact são entidades separadas (mitigado por UX clara).

---

## ADR-018 — Timeline Global Unificada via Event Bus (Append-Only)

**Estado:** 📝 PROPOSTO · **Data:** 2026-07-28 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** O Customer 360° requer um historial cronológico completo de toda a empresa, incluindo eventos de módulos diferentes (Financeiro, Cowork, Reservas). A abordagem naive seria cada módulo escrever directamente na tabela de timeline — mas isso cria acoplamento forte e viola o princípio de independência de módulos.

**Decisão:** A `TimelineEntry` é escrita **exclusivamente** pelos handlers do Event Bus. Nenhum código de negócio escreve directamente na tabela `timeline_entries`. Os módulos externos publicam eventos (`finance.invoice.issued`, `cowork.contract.renewed`, etc.) e o CRM subscreve esses eventos para enriquecer a Timeline. A tabela é **append-only** — sem UPDATE ou DELETE permitidos em `timeline_entries`.

**Alternativas rejeitadas:**
- Cada módulo escreve directamente na Timeline — rejeita por acoplamento forte e inconsistência no formato das entradas.
- Polling periódico de outros módulos — rejeita por latência e complexidade.

**Consequências positivas:** Desacoplamento total entre módulos; Timeline sempre consistente; auditoria implícita; fácil de adicionar novos módulos no futuro.

**Consequências negativas:** Requer que todos os módulos publiquem os eventos correctos; debugging mais complexo (seguir o evento até ao handler).

---

## ADR-019 — Estratégia de Merge de Empresas Duplicadas

**Estado:** 📝 PROPOSTO · **Data:** 2026-07-28 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** Com NIF opcional e criação manual, é inevitável que empresas duplicadas apareçam no sistema. É necessária uma estratégia clara para detectar e resolver duplicados sem perda de dados.

**Decisão:**
1. **Detecção** — algoritmo multi-critério (NIF exacto = CERTAIN; nome ≥ 85% + email = HIGH; etc.) executado no momento de criação.
2. **Merge** — a empresa com registo mais antigo é a base; todos os dados da empresa duplicada são transferidos para a base numa única transacção `prisma.$transaction()`.
3. **Preservação** — a empresa duplicada é marcada `status: MERGED` com `mergedIntoId` apontando para a base; nunca é eliminada fisicamente.
4. **Evento** — `crm.company.merged` publicado no Event Bus; AuditLog com todos os dados transferidos.

**Alternativas rejeitadas:**
- Eliminação física da empresa duplicada — rejeita por perda irreversível de dados e historial.
- Merge manual sem ferramentas de detecção automática — rejeita por depender demasiado do utilizador.

**Consequências negativas:** A tabela `companies` acumula registos `MERGED` ao longo do tempo (mitigado por filtro `WHERE status != 'MERGED'` em todos os queries normais).

---

## ADR-020 — Row-Level Filtering de Companies Adiado para L3

**Estado:** 📝 PROPOSTO · **Data:** 2026-07-28 · **Decisores:** Ernesto Pinto Luciano

**Contexto:** A questão é: no Volume 01 (L2), os utilizadores `COMERCIAL` devem ver apenas as companies que lhes estão atribuídas (`assignedToId === session.userId`) ou todas as companies?

**Decisão:** No L2, todos os utilizadores `COMERCIAL` vêem **todas** as companies. O row-level filtering (cada COMERCIAL só vê as suas) é uma funcionalidade do Nível L3 — Automação Comercial. A razão é que o Azul Coworking tem uma equipa pequena onde a visibilidade partilhada é benéfica, e adicionar row-level filtering no L2 aumentaria significativamente a complexidade sem benefício imediato.

**Alternativas rejeitadas:**
- Implementar row-level filtering no L2 — rejeita por complexidade adicional (queries com `WHERE assignedToId = ?` em todas as listagens, testes adicionais, UX de gestão de visibilidade) sem necessidade demonstrada no contexto actual.

**Consequências negativas:** Um utilizador COMERCIAL pode ver (mas não editar) companies atribuídas a outros. Aceitável no contexto de equipa pequena.

**Revisão:** Rever ao implementar L3 se a equipa tiver crescido e houver necessidade de territórios de vendas.

---

---

## ADR-031 — State Machine Formal para Reservation.status

**Estado:** ✅ ACEITE · **Data:** 2026-07-29 · **Decisores:** Ernesto Pinto Luciano  
**Volume:** VOL04 — Reservas · **Ficheiro:** [ADR-031-reservation-state-machine.md](./ADR-031-reservation-state-machine.md)

**Contexto:** O módulo de Reservas não tinha qualquer validação de transições de estado — qualquer status podia ser escrito em qualquer PATCH, incluindo reactivar CONCLUIDA ou CANCELADA.

**Decisão:** Criar `src/lib/reservation-state-machine.ts` com `VALID_TRANSITIONS`, `canTransition()`, `assertValidTransition()`, `isCancellationFree()` e `CANCELLATION_FREE_HOURS = 24`. Toda API que muta `status` deve chamar `assertValidTransition()` antes de persistir.

**Consequências:** 25 testes unitários cobrem 100% das transições; estados terminais são garantidos pelo servidor; sem breaking change de schema.

---

## ADR-032 — $transaction Serializable para Conflict Check (DT-013)

**Estado:** ✅ ACEITE · **Data:** 2026-07-29 · **Decisores:** Ernesto Pinto Luciano  
**Volume:** VOL04 — Reservas · **Ficheiro:** [ADR-032-serializable-conflict-check.md](./ADR-032-serializable-conflict-check.md)

**Contexto:** Conflict check executava `findFirst` + `create/update` em operações separadas — janela TOCTOU que permitia double-booking em requests concorrentes (DT-013).

**Decisão:** Mover conflict check e escrita atómica para `prisma.$transaction(async(tx) => ..., { isolationLevel: Serializable })`. Para PATCH de horário, a tx serializable é usada apenas quando `startDatetime` ou `endDatetime` mudam. `P2034` retornado como HTTP 409 "Tente novamente".

**Consequências:** Race condition eliminada a nível de BD, sem schema changes, sem dependências externas.

---

## ADR-033 — Post-Commit Pattern para recordFinancialHistory (DT-017)

**Estado:** ✅ ACEITE · **Data:** 2026-07-29 · **Decisores:** Ernesto Pinto Luciano  
**Volume:** VOL04 — Reservas · **Ficheiro:** [ADR-033-post-commit-financial-history.md](./ADR-033-post-commit-financial-history.md)

**Contexto:** `recordFinancialHistory()` era chamada dentro de `$transaction` — uma falha de auditoria fazia rollback da reserva e do pagamento (DT-017).

**Decisão:** Chamar `recordFinancialHistory` APÓS `await $transaction()`, usando cliente `prisma` (não `tx`), com `.catch()` para absorver falhas silenciosamente. Falhas ficam observáveis apenas nos logs.

**Consequências:** Falha de auditoria nunca desfaz operação financeira. Risco aceitável de inconsistência eventual mitigado por alertas quando DT-009 (Sentry) estiver activo.

---

## ADR-034 — MeetingPlan como SSoT de Preços; RoomPricing como Legado

**Estado:** ✅ ACEITE · **Data:** 2026-07-29 · **Decisores:** Ernesto Pinto Luciano  
**Volume:** VOL04 — Reservas · **Ficheiro:** [ADR-034-meetingplan-pricing-ssot.md](./ADR-034-meetingplan-pricing-ssot.md)

**Contexto:** Existiam dois sistemas de preços paralelos sem hierarquia: `MeetingPlan` (campos directos) e `RoomPricing` (tabela separada por tier). Violava SSoT.

**Decisão:** `MeetingPlan` é declarado SSoT. `calcPrice()` usa exclusivamente campos de `MeetingPlan`. `RoomPricing` mantém-se no schema mas marcado `[LEGADO]` — nenhuma lógica nova lê desta tabela. Remoção planeada para VOL05+.

**Consequências:** SSoT claro; `calcPrice` 100% puro e testável (37 casos); nenhuma query adicional para preços (já no include de Reservation→MeetingPlan).

---

*VD Platform — Architecture Decision Records v2.0.0 — Julho 2026*
