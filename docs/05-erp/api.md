# ERP — API Reference

> **Volume:** 02 — ERP  
> **Estado:** 📝 Especificação — Sprint ERP-0  
> **Base URL:** `/api/erp`  
> **Autenticação:** JWT via cookie `vd_admin_session`  
> **Rate Limiting:** 60 req/min (global); endpoints de mutação: `isApiRateLimited(ip, key)`

---

## 1. Convenções

Seguem as mesmas convenções do Volume 01 (CRM API):

```typescript
// Sucesso
{ "data": T, "meta"?: { total, page, pageSize } }

// Erro
{ "error": string, "code"?: string }
```

---

## 2. Contratos API

### `GET /api/erp/contracts`

**Query:** `status?`, `companyId?`, `planType?`, `expiringDays?`, `page?`, `pageSize?`  
**Permissões:** ADMIN, FINANCEIRO, COMERCIAL (próprios), VIEWER

### `POST /api/erp/contracts`

```typescript
{
  companyId:         string;
  planType:          ContractPlanType;
  startDate:         string;          // ISO8601
  endDate?:          string;
  monthlyValue:      number;          // AOA
  depositAmount?:    number;
  autoRenew?:        boolean;
  renewalNoticeDays?: number;
  adjustmentRules?:  object;
  notes?:            string;
}
```

**Permissões:** ADMIN  
**Eventos:** `erp.contract.created`

### `GET /api/erp/contracts/:id`

Inclui: `rentSchedules`, `invoices` (últimas 6), `company`  
**Permissões:** ADMIN, FINANCEIRO, COMERCIAL (próprios)

### `PATCH /api/erp/contracts/:id`

Campos editáveis em DRAFT: todos. Em ACTIVE: `notes`, `autoRenew`, `renewalNoticeDays`, `adjustmentRules`, `attachments`.  
**Permissões:** ADMIN

### `POST /api/erp/contracts/:id/activate`

Transição DRAFT → ACTIVE. Gera `RentSchedule[]`.  
**Permissões:** ADMIN  
**Eventos:** `erp.contract.activated`

### `POST /api/erp/contracts/:id/suspend`

Body: `{ reason: string }`  
**Permissões:** ADMIN  
**Eventos:** `erp.contract.suspended`

### `POST /api/erp/contracts/:id/terminate`

Body: `{ reason: string, terminatedAt?: string }`  
**Permissões:** ADMIN  
**Eventos:** `erp.contract.terminated`

### `POST /api/erp/contracts/:id/deposit/confirm`

Body: `{ paidAt: string, reference?: string }`  
**Permissões:** ADMIN, FINANCEIRO  
**Eventos:** `erp.contract.depositPaid`

---

## 3. Faturas API

### `GET /api/erp/invoices`

**Query:** `status?`, `type?`, `companyId?`, `from?`, `to?`, `page?`, `pageSize?`  
**Permissões:** ADMIN, FINANCEIRO, COMERCIAL (próprias empresas)

### `POST /api/erp/invoices`

```typescript
{
  type:        InvoiceType;
  companyId?:  string;
  bookingId?:  string;
  contractId?: string;
  dueDate:     string;
  items:       Array<{
    description: string;
    quantity:    number;
    unitPrice:   number;
    accountCode: string;
    costCenterId?: string;
  }>;
  notes?:      string;
}
```

**Permissões:** ADMIN, FINANCEIRO  
**Eventos:** `erp.invoice.created`

### `GET /api/erp/invoices/:id`

Inclui: `items`, `payments`, `company`  
**Permissões:** ADMIN, FINANCEIRO

### `PATCH /api/erp/invoices/:id`

Apenas faturas em DRAFT.  
**Permissões:** ADMIN, FINANCEIRO

### `POST /api/erp/invoices/:id/issue`

DRAFT → ISSUED. Gera número, calcula IVA, gera PDF.  
**Permissões:** ADMIN, FINANCEIRO  
**Eventos:** `erp.invoice.issued`

### `POST /api/erp/invoices/:id/send`

Envia PDF por email via Resend.  
**Permissões:** ADMIN, FINANCEIRO  
**Eventos:** `erp.invoice.sent`

### `POST /api/erp/invoices/:id/void`

Body: `{ reason: string }`  
Bloqueio: sem pagamentos confirmados.  
**Permissões:** ADMIN  
**Eventos:** `erp.invoice.voided`

---

## 4. Pagamentos API

### `GET /api/erp/payments`

**Query:** `status?`, `companyId?`, `invoiceId?`, `from?`, `to?`, `page?`  
**Permissões:** ADMIN, FINANCEIRO

### `POST /api/erp/payments`

```typescript
{
  invoiceId:   string;
  amount:      number;
  method:      PaymentMethod;
  reference?:  string;
  paidAt:      string;
  notes?:      string;
}
```

**Permissões:** ADMIN, FINANCEIRO  
**Eventos:** `erp.payment.registered`

### `POST /api/erp/payments/:id/confirm`

Body: `{ confirmedAt?: string }`  
**Permissões:** ADMIN, FINANCEIRO  
**Eventos:** `erp.payment.confirmed`

### `POST /api/erp/payments/:id/reject`

Body: `{ reason: string }`  
**Permissões:** ADMIN  
**Eventos:** `erp.payment.rejected`

### `POST /api/erp/payments/:id/refund`

Body: `{ reason: string }`  
**Permissões:** ADMIN  
**Eventos:** `erp.payment.refunded`

---

## 5. Despesas API

### `GET /api/erp/expenses`

**Query:** `status?`, `categoryId?`, `costCenterId?`, `from?`, `to?`, `page?`  
**Permissões:** ADMIN, FINANCEIRO

### `POST /api/erp/expenses`

```typescript
{
  categoryId:   string;
  costCenterId?: string;
  supplierName?: string;
  supplierNif?:  string;
  description:   string;
  amount:        number;
  dueDate:       string;
  recurrence?:   ExpenseRecurrence;
  receiptUrl?:   string;
  notes?:        string;
}
```

**Permissões:** ADMIN, FINANCEIRO  
**Eventos:** `erp.expense.created`

### `POST /api/erp/expenses/:id/approve`

**Permissões:** ADMIN  
**Eventos:** `erp.expense.approved`

### `POST /api/erp/expenses/:id/pay`

Body: `{ paidAt: string, reference?: string }`  
**Permissões:** ADMIN, FINANCEIRO  
**Eventos:** `erp.expense.paid`

### `GET /api/erp/expenses/categories`

Lista categorias disponíveis.  
**Permissões:** ADMIN, FINANCEIRO

---

## 6. Cash Flow API

### `GET /api/erp/cashflow`

**Query:** `from?`, `to?`, `view?` (daily|weekly|monthly), `projected?` (boolean)  
**Resposta:** `{ movements: CashMovement[], summary: { inflows, outflows, balance, projectedBalance } }`  
**Permissões:** ADMIN, FINANCEIRO

### `POST /api/erp/cashflow/movements`

Registo manual de movimento de caixa.  
Body: `{ date, type, amount, description, bankAccount? }`  
**Permissões:** ADMIN, FINANCEIRO

### `GET /api/erp/cashflow/projection`

**Query:** `days?` (default: 90)  
Retorna projecção de saldo dia a dia para os próximos N dias.  
**Permissões:** ADMIN, FINANCEIRO

---

## 7. Alertas API

### `GET /api/erp/alerts`

**Query:** `status?`, `type?`, `severity?`, `companyId?`  
**Permissões:** ADMIN, FINANCEIRO (todos); COMERCIAL (seus clientes)

### `PATCH /api/erp/alerts/:id`

```typescript
{
  action: "acknowledge" | "resolve" | "snooze";
  snoozeUntil?: string;  // ISO8601, obrigatório se action=snooze
  resolution?:  string;  // nota de resolução
}
```

**Permissões:** ADMIN, FINANCEIRO

### `POST /api/erp/alerts`

Criar alerta manual.  
**Permissões:** ADMIN

---

## 8. Dashboard / Relatórios API

### `GET /api/erp/dashboard`

Retorna todos os KPIs do dashboard financeiro.  
**Permissões:** ADMIN, FINANCEIRO; COMERCIAL (KPIs limitados)

### `GET /api/erp/reports/pl`

**Query:** `period?` (YYYY-MM), `type?` (monthly|quarterly|annual)  
**Permissões:** ADMIN, FINANCEIRO

### `GET /api/erp/reports/aging`

Relatório de contas a receber por antiguidade.  
**Permissões:** ADMIN, FINANCEIRO

### `GET /api/erp/reports/contracts`

Relatório de contratos.  
**Permissões:** ADMIN, FINANCEIRO, VIEWER

### `GET /api/erp/reports/mrr`

Evolução do MRR.  
**Permissões:** ADMIN, FINANCEIRO

---

## 9. Ledger API (só leitura)

### `GET /api/erp/ledger`

**Query:** `accountCode?`, `from?`, `to?`, `costCenterId?`, `companyId?`, `page?`  
**Permissões:** ADMIN, FINANCEIRO  
**Nota:** O ledger é read-only via API. Escrita apenas via lógica interna.

---

*VD Platform — ERP — API Reference — Sprint ERP-0*
