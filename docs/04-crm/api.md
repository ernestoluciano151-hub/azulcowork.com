# CRM — API Reference

> **Versão:** 1.2.0  
> **Volume:** 01 — CRM  
> **Estado:** ✅ Em vigor (RFT-100 → RFT-109 + Sprint CRM-4 concluídos)  
> **Base URL:** `/api/crm`  
> **Autenticação:** JWT via cookie `vd_admin_session` (obrigatório em todos os endpoints)  
> **Rate Limiting:** 60 req/min por IP (global) · endpoints de mutação: `isApiRateLimited(ip, key)`

---

## 1. Convenções

### Formato de Resposta

```typescript
// Sucesso
{ "data": T, "meta"?: { total, page, pageSize } }

// Erro
{ "error": string, "code"?: string, "field"?: string }
```

### Códigos de Erro

| HTTP | Significado |
|---|---|
| `400` | Dados inválidos (validação) |
| `401` | Não autenticado |
| `403` | Sem permissão (RBAC) |
| `404` | Recurso não encontrado |
| `409` | Conflito (ex.: NIF duplicado) |
| `422` | Regra de negócio violada |
| `429` | Rate limit excedido |
| `500` | Erro interno (capturado pelo Sentry) |

### Paginação

Todos os endpoints de listagem suportam:
```
?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc
```

---

## 2. Companies API

### `GET /api/crm/companies`

Lista empresas com filtros.

**Query params:**
```
status?        CompanyStatus
pipelineStage? PipelineStage
assignedToId?  string
search?        string (name, NIF, email)
tag?           string[]
page?          number (default: 1)
pageSize?      number (default: 20, max: 100)
sortBy?        createdAt | name | lastContactedAt | nextFollowUpAt
sortOrder?     asc | desc
```

**Permissões:** `ADMIN`, `COMERCIAL`, `VIEWER`  
**Rate limit:** `isApiRateLimited(ip, "crm-companies")`

**Resposta:**
```typescript
{
  data: Company[],
  meta: { total: number, page: number, pageSize: number, totalPages: number }
}
```

---

### `POST /api/crm/companies`

Cria uma nova empresa.

**Body:**
```typescript
{
  name:          string;          // obrigatório, min 2 chars
  nif?:          string;          // único no sistema
  sector?:       string;
  website?:      string;
  phone?:        string;
  email?:        string;
  address?:      string;
  city?:         string;
  country?:      string;          // default: "Angola"
  assignedToId?: string;          // FK para Admin
  source?:       "MANUAL" | "IMPORT" | "FORM" | "API";
}
```

**Permissões:** `ADMIN`, `COMERCIAL`  
**Eventos:** `crm.company.created`, `crm.lead.captured`  
**Erros específicos:**
- `409` — NIF já existe no sistema (com `companyId` da empresa existente)

---

### `GET /api/crm/companies/:id`

Retorna Customer 360° completo de uma empresa.

**Inclui:** contacts, deals, activities (últimas 10), tasks (abertas), notes (últimas 5), tags, timeline (últimas 20 entradas)

**Permissões:** `ADMIN`, `COMERCIAL`, `VIEWER`

---

### `PATCH /api/crm/companies/:id`

Actualiza dados de uma empresa (patch parcial).

**Body:** qualquer subset dos campos de `POST /api/crm/companies`

**Permissões:** `ADMIN`, `COMERCIAL`  
**Eventos:** `crm.company.updated`, `crm.company.statusChanged` (se status alterado), `crm.company.ownerChanged` (se assignedToId alterado)

---

### `DELETE /api/crm/companies/:id`

Soft-delete de uma empresa.

**Restrições (422 se violadas):**
- Empresa tem Deals activos (stage ≠ WON e ≠ LOST)
- Empresa tem Employees activos
- Empresa tem Facturas em aberto

**Permissões:** `ADMIN` apenas  
**Eventos:** `crm.company.deleted`

---

### `POST /api/crm/companies/:id/merge`

Merge de duas empresas. Transfere todas as relações da empresa de origem para a empresa de destino.

**Body:**
```typescript
{
  sourceId: string;   // empresa a absorver (ficará marcada como MERGED)
  reason?:  string;   // motivo do merge (auditoria)
}
```

**Regras:**
- `:id` é a empresa de destino (survives — mantém o ID)
- `sourceId` é marcada `crmStatus=MERGED`, `crmDeletedAt=now`, `mergedIntoId=:id`
- Transferências em `$transaction`: CrmContacts, CrmDeals, CrmActivities, CrmTasks, CrmNotes, CompanyTags (deduplication), TimelineEntries, CrmAuditLogs
- **Bloqueios (422):** self-merge; empresa source já `MERGED`; source tem deals em stage `WON`

**Permissões:** `ADMIN` apenas  
**Eventos:** `crm.company.merged` (publicado após transacção)

---

### `GET /api/crm/companies/:id/timeline`

Timeline paginada de uma empresa.

**Query params:**
```
eventType?  TimelineEventType (filtro)
from?       ISO8601
to?         ISO8601
page?       number
pageSize?   number (max: 50)
```

**Permissões:** `ADMIN`, `COMERCIAL`, `VIEWER`

---

## 3. Contacts API

### `GET /api/crm/companies/:companyId/contacts`
### `POST /api/crm/companies/:companyId/contacts`
### `PATCH /api/crm/companies/:companyId/contacts/:contactId`
### `DELETE /api/crm/companies/:companyId/contacts/:contactId`

**Body POST/PATCH:**
```typescript
{
  firstName:  string;
  lastName:   string;
  email?:     string;
  phone?:     string;
  role?:      ContactRole;
  isPrimary?: boolean;
}
```

**Regras:**
- `isPrimary: true` remove automaticamente `isPrimary` do contacto anterior
- Não é possível eliminar o único contacto de uma empresa sem substituí-lo

**Permissões:** `ADMIN`, `COMERCIAL`  
**Eventos:** `crm.contact.added`, `crm.contact.removed`, `crm.contact.primaryChanged`

---

## 4. Deals API

### `GET /api/crm/companies/:companyId/deals`
### `POST /api/crm/companies/:companyId/deals`

**Body POST:**
```typescript
{
  title:               string;
  stage?:              DealStage;      // default: QUALIFICATION
  value?:              number;         // default: 0
  probability?:        number;         // 0-100
  assignedToId?:       string;
  expectedCloseDate?:  string;         // ISO8601
}
```

### `PATCH /api/crm/companies/:companyId/deals/:dealId`

**Campos especiais:**
- Mudar `stage → WON`: requer `closedAt` e `value > 0` → evento `crm.deal.won`
- Mudar `stage → LOST`: requer `lostReason` → evento `crm.deal.lost`

**Permissões:** `ADMIN`, `COMERCIAL`, `VIEWER`

---

## 5. Activities API

### `GET /api/crm/companies/:companyId/activities`
### `POST /api/crm/companies/:companyId/activities`

**Body POST:**
```typescript
{
  type:        ActivityType;
  direction?:  ActivityDirection;    // default: OUTBOUND
  subject:     string;
  description?: string;
  outcome?:    string;
  contactId?:  string;
  dealId?:     string;
  occurredAt?: string;               // ISO8601, default: now()
}
```

**Eventos:** `crm.activity.logged` + evento específico por tipo

---

## 6. Tasks API

### `GET /api/crm/companies/:companyId/tasks`
### `POST /api/crm/companies/:companyId/tasks`
### `PATCH /api/crm/companies/:companyId/tasks/:taskId`
### `GET /api/crm/tasks/my` — tarefas do utilizador autenticado

**Body POST/PATCH:**
```typescript
{
  title:        string;
  description?: string;
  priority?:    TaskPriority;
  status?:      TaskStatus;
  assignedToId?: string;
  dealId?:      string;
  dueDate?:     string;             // ISO8601
}
```

**Acções especiais:**
- `PATCH` com `status: "DONE"` → seta `completedAt: now()` → evento `crm.task.completed`

---

## 7. Notes API

### `GET /api/crm/companies/:companyId/notes`
### `POST /api/crm/companies/:companyId/notes`
### `PATCH /api/crm/companies/:companyId/notes/:noteId`
### `DELETE /api/crm/companies/:companyId/notes/:noteId`

**Body POST/PATCH:**
```typescript
{
  content:    string;     // Markdown, max 10.000 chars
  dealId?:    string;
  contactId?: string;
}
```

**Regras:** Só o autor ou um `ADMIN` pode editar/eliminar uma nota.

---

## 8. Tags API

### `GET /api/crm/tags`

Lista todas as tags globais do sistema com contagem de empresas associadas.

**Resposta:**
```typescript
{ data: Array<{ id: string; name: string; color: string; _count: { companyTags: number } }> }
```

**Permissões:** `ADMIN`, `COMERCIAL`, `VIEWER`

---

### `POST /api/crm/tags`

Cria uma nova tag global.

**Body:**
```typescript
{ name: string; color?: string; }  // color: hex #RRGGBB, default: "#64748B"
```

**Regras:**
- `name` é convertido para lowercase, normalizado (sem acentos, espaços → hífens)
- Conflito de nome (case-insensitive) → `409`
- Cor deve ser hex válido `/^#[0-9A-Fa-f]{6}$/`

**Permissões:** `ADMIN` apenas  
**Auditoria:** `CrmAuditLog` com `companyId: null`, `action: "TAG_CREATED"`

---

### `PATCH /api/crm/tags/:tagId`

Actualiza nome e/ou cor de uma tag.

**Body:** `{ name?: string; color?: string; }`

**Erros:** `404` tag não encontrada · `409` conflito de nome

**Permissões:** `ADMIN` apenas

---

### `DELETE /api/crm/tags/:tagId`

Elimina uma tag global.

**Bloqueio (409):** tag está associada a pelo menos 1 empresa (`_count.companyTags > 0`)

**Permissões:** `ADMIN` apenas

---

### `GET /api/crm/companies/:id/tags`

Lista todas as tags de uma empresa.

**Resposta:** `{ data: Tag[] }`

**Permissões:** `ADMIN`, `COMERCIAL`, `VIEWER`

---

### `POST /api/crm/companies/:id/tags`

Associa uma ou mais tags a uma empresa.

**Body:** `{ tagIds: string[] }`

**Regras:**
- BR-TAG-001: máximo 20 tags por empresa → `422` se excedido
- Tags já associadas são ignoradas (idempotente)

**Permissões:** `ADMIN`, `COMERCIAL`

---

### `DELETE /api/crm/companies/:id/tags/:tagId`

Remove a associação de uma tag a uma empresa.

**Permissões:** `ADMIN`, `COMERCIAL`  
**Auditoria:** `CrmAuditLog` com `action: "TAG_REMOVED"`

---

## 9. Dashboard API

### `GET /api/crm/dashboard`

Retorna KPIs e métricas do CRM em tempo real.

**Âmbito:** `ADMIN`/`FINANCEIRO` → global · `COMERCIAL` → personal (apenas registos com `assignedToId = userId`)

**Resposta:**
```typescript
{
  scope:       "global" | "personal",
  generatedAt: string,             // ISO8601

  companies: {
    total:   number,
    byStage: Record<PipelineStage, number>,  // contagem de empresas por stage
    byStatus: Record<CompanyStatus, number>,
  },

  pipeline: {
    totalValue: number,            // soma de value de deals não-terminais
    byStage:    Record<DealStage, { count: number; totalValue: number }>,
  },

  performance: {
    wonTotal:        number,       // deals WON histórico
    won30d:          number,       // deals WON nos últimos 30 dias
    won90d:          number,       // deals WON nos últimos 90 dias
    wonValueAOA:     number,       // valor total dos deals WON (AOA)
    avgCycleDays:    number | null, // média DISCOVERY → WON
    conversionRate:  number | null, // WON / (WON + LOST) * 100
  },

  tasks: {
    pending:    number,
    inProgress: number,
    overdue:    number,            // tasks com dueDate < now e status ≠ DONE
  },

  recentActivities: Array<{
    id:         string;
    type:       ActivityType;
    summary:    string;
    occurredAt: string;
    company:    { id: string; name: string };
  }>,                              // últimas 7 actividades
}
```

**Permissões:** `ADMIN`, `COMERCIAL`, `FINANCEIRO`, `VIEWER`

---

## 10. Duplicate Detection API

### `POST /api/crm/companies/check-duplicate`

Verifica se uma empresa é potencial duplicado antes de criar. Usado no formulário de nova empresa.

**Body:**
```typescript
{
  name:       string;
  nif?:       string;
  excludeId?: string;  // excluir empresa actual (útil no edit)
}
```

**Resposta:**
```typescript
{
  hasDuplicate: boolean,
  exactNif:     Company | null,  // correspondência exacta de NIF
  similar:      Array<{
    id:              string,
    name:            string,
    nif:             string | null,
    similarityScore: number,     // 0.0–1.0 (Levenshtein normalizado)
  }>                              // top 10, threshold ≥ 0.85
}
```

**Algoritmo:** NIF exact match + `similarityScore()` (Levenshtein) sobre até 500 empresas activas.

**Permissões:** `ADMIN`, `COMERCIAL`

---

### `GET /api/crm/companies/duplicates`

Análise global de potenciais duplicados em toda a base de dados CRM.

**Query params:**
```
threshold?  number   (default: 0.85, min: 0.70, max: 1.00)
limit?      number   (default: 50, max: 200)
```

**Resposta:**
```typescript
{
  data: Array<{
    company1: { id: string; name: string; nif: string | null },
    company2: { id: string; name: string; nif: string | null },
    score:    number,
  }>,
  meta: { total: number; threshold: number; analysed: number }
}
```

**Algoritmo:** Comparação O(n²) sobre até 1000 empresas activas.  
**Permissões:** `ADMIN` apenas

---

## 11. Pipeline Kanban API

### `GET /api/crm/pipeline`

Vista Kanban do funil comercial — empresas agrupadas por `pipelineStage`.

**Query params:**
```
stages?  string   CSV de PipelineStage (default: "NEW_LEAD,CONTACTED,QUALIFIED,PROPOSAL_SENT,NEGOTIATION")
search?  string   filtro por nome de empresa
```

**Resposta:**
```typescript
{
  columns: Array<{
    stage:      PipelineStage,
    count:      number,
    totalValue: number,          // soma de value dos deals activos nesta coluna
    companies:  Array<{
      id:             string,
      name:           string,
      sector:         string | null,
      primaryContact: { firstName: string; lastName: string; email: string | null } | null,
      activeDeals:    Array<{ id: string; title: string; value: number | null }>,
      lastActivity:   { type: ActivityType; summary: string } | null,
      taskCount:      number,    // tasks PENDING ou IN_PROGRESS
      dealValue:      number,    // soma de value dos deals activos
    }>
  }>,
  meta: {
    totalCompanies: number,
    wonCount:       number,      // empresas em stage WON
    lostCount:      number,      // empresas em stage LOST
    scope:          "global" | "personal",
  }
}
```

**Âmbito:** `ADMIN`/`FINANCEIRO` → global · `COMERCIAL` → personal  
**Permissões:** `ADMIN`, `COMERCIAL`, `VIEWER`

---

## 12. Lead Migration API

### `POST /api/crm/migrate-leads`

Migração idempotente de Leads legados para o CRM como empresas CRM.

**Query params:**
```
dryRun?  boolean  (default: false) — simula sem persistir
limit?   number   (default: 100, max: 500)
```

**Comportamento:**
- **Caso A** — Lead tem `leadCompanyId` e empresa tem `pipelineStage = null`: actualiza `pipelineStage` via mapeamento de status
- **Caso B** — Lead sem `leadCompanyId`: cria `Company` com `planType="CRM_LEAD"`, cria `CrmContact` com dados do Lead, escreve `TimelineEntry COMPANY_CREATED`, liga `Lead.leadCompanyId`
- Idempotente: Leads já migrados (com `leadCompanyId` e `pipelineStage` preenchidos) são ignorados

**Mapeamento de status (15 valores):**

| Lead.status | PipelineStage |
|---|---|
| `novo`, `new`, `pendente` | `NEW_LEAD` |
| `contactado`, `contacted`, `em contacto` | `CONTACTED` |
| `qualificado`, `qualified` | `QUALIFIED` |
| `proposta`, `proposta enviada`, `proposal` | `PROPOSAL_SENT` |
| `negociacao`, `negociação`, `negotiation` | `NEGOTIATION` |
| `ganho`, `won`, `convertido` | `WON` |

**Resposta:**
```typescript
{
  dryRun:  boolean,
  created: number,
  updated: number,
  skipped: number,
  errors:  Array<{ leadId: string; reason: string }>,
}
```

**Permissões:** `ADMIN` apenas

---

*VD Platform — CRM API Reference — v1.2.0 — 28 Julho 2026*  
*© 2026 VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA. Confidencial.*
