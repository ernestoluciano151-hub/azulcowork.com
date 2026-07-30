# CRM — Estratégia de Testes

> **Versão:** 1.0.0-draft  
> **Volume:** 01 — CRM  
> **Estado:** 📝 Em elaboração  
> **Stack:** Vitest 4.1.10 · @vitest/coverage-v8 · cobertura mínima: 60% (herdada da P0-C)

---

## 1. Objectivos

- Manter cobertura global ≥ 60% após adição do CRM
- Cobrir 100% das regras de negócio críticas (BR-CRM-*, BR-PIPE-*)
- Cobrir 100% das transições de estado do pipeline
- Cobrir 100% dos event handlers CRM
- Zero regressões nos módulos existentes (finance, auth, rateLimit)

---

## 2. Pirâmide de Testes

```
         /\
        /E2E\          ← 10% · Fluxos críticos end-to-end
       /──────\
      / Integr \       ← 30% · API Routes + DB + Event Bus
     /──────────\
    /  Unitários \     ← 60% · Funções puras, helpers, validators
   /______________\
```

---

## 3. Testes Unitários

### 3.1 Validadores CRM

```typescript
// tests/crm/validators.test.ts

describe("Company validators", () => {
  it("rejeita nome com menos de 2 caracteres")
  it("rejeita NIF com formato inválido")
  it("normaliza tags: lowercase, espaços → hífens")
  it("rejeita mais de 20 tags por empresa")
  it("valida email principal da empresa")
});

describe("Deal validators", () => {
  it("rejeita deal WON sem value > 0")
  it("rejeita deal LOST sem lostReason")
  it("rejeita probability fora de [0, 100]")
  it("rejeita desconto > 10% sem approvedBy ADMIN")
});

describe("Pipeline state machine", () => {
  it("permite NEW_LEAD → CONTACTED")
  it("permite CONTACTED → QUALIFIED")
  it("permite NEGOTIATION → WON")
  it("permite NEGOTIATION → LOST")
  it("proíbe WON → qualquer outro stage")
  it("proíbe transição para MERGED manualmente")
  it("permite LOST → NEW_LEAD (re-engagement)")
});
```

### 3.2 Business Rules

```typescript
// tests/crm/business-rules.test.ts

describe("BR-CRM-001: Company criada com NEW_LEAD", () => {
  it("cria company com status PROSPECT e stage NEW_LEAD")
});

describe("BR-CRM-002: ACTIVE requer deal.won", () => {
  it("rejeita company.status = ACTIVE sem deal.won")
  it("aceita company.status = ACTIVE após deal.won")
});

describe("BR-CRM-007: Um deal em NEGOTIATION por empresa", () => {
  it("rejeita segundo deal em NEGOTIATION para a mesma empresa")
  it("permite deal em NEGOTIATION se o anterior foi para WON ou LOST")
});

describe("BR-CRM-008: NIF único", () => {
  it("rejeita criação com NIF já existente")
  it("permite criação com NIF nulo (múltiplos)")
  it("permite NIF igual se empresa original está MERGED")
});

describe("BR-CRM-010: Tasks vencidas > 24h", () => {
  it("detecta task vencida à mais de 24h")
  it("não reporta task vencida à menos de 24h")
  it("não reporta task concluída")
});
```

### 3.3 Event Mapping

```typescript
// tests/crm/event-handlers.test.ts

describe("Timeline Handler", () => {
  it("mapeia crm.company.created para TimelineEntry COMPANY_CREATED")
  it("mapeia crm.deal.won para TimelineEntry DEAL_WON com valor")
  it("mapeia crm.deal.lost para TimelineEntry DEAL_LOST com lostReason")
  it("mapeia crm.task.overdue para TimelineEntry TASK_OVERDUE")
  it("não gera TimelineEntry para crm.contact.updated")
  it("mapeia finance.invoice.issued para TimelineEntry INVOICE_ISSUED")
  it("mapeia cowork.contract.renewed para TimelineEntry CONTRACT_RENEWED")
});

describe("Follow-up Auto-creation Handler", () => {
  it("cria task de follow-up 3 dias após proposal.sent")
  it("não cria duplicado se follow-up já existe")
  it("atribui follow-up ao owner do deal")
});

describe("Duplicate Detection", () => {
  it("detecta duplicado por NIF exacto — confidence: CERTAIN")
  it("detecta duplicado por nome similar ≥ 85% — confidence: HIGH")
  it("detecta duplicado por email — confidence: HIGH")
  it("não detecta false positives com nomes curtos genéricos")
});
```

---

## 4. Testes de Integração (API Routes)

```typescript
// tests/crm/api/companies.test.ts

describe("POST /api/crm/companies", () => {
  it("cria empresa e publica crm.company.created")
  it("rejeita NIF duplicado com 409")
  it("rejeita nome em branco com 400")
  it("rejeita utilizador VIEWER com 403")
  it("rejeita utilizador não autenticado com 401")
  it("aplica rate limiting: 429 após limite excedido")
});

describe("PATCH /api/crm/companies/:id", () => {
  it("actualiza dados e publica crm.company.updated")
  it("publica crm.company.statusChanged ao mudar status")
  it("publica crm.company.ownerChanged ao mudar assignedToId")
  it("rejeita utilizador VIEWER com 403")
});

describe("DELETE /api/crm/companies/:id", () => {
  it("soft-delete com deletedAt preenchido")
  it("rejeita se company tem deals activos — 422")
  it("rejeita utilizador COMERCIAL com 403")
  it("rejeita utilizador ADMIN com empresa não encontrada — 404")
});

describe("POST /api/crm/companies/:id/merge", () => {
  it("transfere contacts, deals, activities, tasks para empresa base")
  it("marca empresa duplicada como MERGED")
  it("publica crm.company.merged")
  it("cria AuditLog com todos os dados transferidos")
  it("é idempotente: re-merge não duplica dados")
});

describe("GET /api/crm/companies/:id/timeline", () => {
  it("retorna entradas ordenadas por occurredAt DESC")
  it("filtra por eventType quando fornecido")
  it("filtra por intervalo de datas")
  it("pagina correctamente (page, pageSize)")
});
```

```typescript
// tests/crm/api/deals.test.ts

describe("Pipeline state transitions via API", () => {
  it("transição WON actualiza company.status → ACTIVE")
  it("transição LOST requer lostReason — 422 se ausente")
  it("transição NEGOTIATION rejeita se já existe deal em NEGOTIATION — 422")
});
```

---

## 5. Testes de Dados (Integridade)

```typescript
// tests/crm/data-integrity.test.ts

describe("Soft delete integrity", () => {
  it("company deletedAt exclui das listagens normais")
  it("company deletedAt não exclui da timeline existente")
  it("contact deletedAt exclui das listagens da empresa")
});

describe("Append-only enforcement", () => {
  it("TimelineEntry não pode ser actualizada")
  it("AuditLog não pode ser actualizado")
  it("AuditLog não pode ser eliminado")
});

describe("FK integrity", () => {
  it("Contact não pode ser criado sem companyId válido")
  it("Deal não pode ser criado sem companyId válido")
  it("Activity não pode ser criada sem companyId válido")
});

describe("Duplicate NIF detection at DB level", () => {
  it("índice único previne NIF duplicado mesmo em race condition")
});
```

---

## 6. Cobertura Esperada por Módulo

| Módulo | Linhas Alvo | Branching Alvo |
|---|---|---|
| `src/lib/crm-validators.ts` | ≥ 90% | ≥ 85% |
| `src/lib/crm-service.ts` | ≥ 80% | ≥ 75% |
| `src/lib/crm-event-handlers.ts` | ≥ 85% | ≥ 80% |
| `src/lib/pipeline-state-machine.ts` | ≥ 95% | ≥ 90% |
| `src/app/api/crm/**` | ≥ 70% | ≥ 65% |
| **Global (mínimo P0-C)** | **≥ 60%** | — |

---

## 7. Fixtures e Mocks

```typescript
// tests/helpers/crm-fixtures.ts

export const mockCompany = (overrides = {}): Company => ({
  id: "co-test-001",
  name: "Empresa Teste Lda",
  nif: "5001234567",
  status: "PROSPECT",
  pipelineStage: "NEW_LEAD",
  assignedToId: "admin-test-001",
  country: "Angola",
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-01"),
  deletedAt: null,
  ...overrides,
});

export const mockDeal = (overrides = {}): Deal => ({
  id: "dl-test-001",
  companyId: "co-test-001",
  title: "Plano Coworking Premium",
  stage: "QUALIFICATION",
  value: 2500000,
  currency: "AOA",
  probability: 50,
  createdAt: new Date("2026-07-15"),
  updatedAt: new Date("2026-07-15"),
  ...overrides,
});

export const mockTimelineEntry = (overrides = {}): TimelineEntry => ({
  id: "tl-test-001",
  companyId: "co-test-001",
  eventType: "COMPANY_CREATED",
  title: "Empresa adicionada ao CRM",
  isSystem: false,
  occurredAt: new Date("2026-07-01"),
  createdAt: new Date("2026-07-01"),
  metadata: {},
  ...overrides,
});
```

---

*VD Platform — CRM Test Strategy — v1.0.0-draft — 28 Julho 2026*  
*© 2026 VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA. Confidencial.*
