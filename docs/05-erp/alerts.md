# ERP — Alertas Financeiros

> **Volume:** 02 — ERP  
> **Estado:** ✅ Implementado — Sprint ERP-6 (29 Jul 2026)

---

## 1. Tipos de Alerta

| Tipo | Gatilho | Severidade | Automático |
|---|---|---|---|
| `PAYMENT_OVERDUE` | Invoice não paga após `dueDate` | WARNING → CRITICAL | ✅ Cron diário |
| `CONTRACT_EXPIRING` | `endDate` em 60/30/7 dias | INFO → WARNING → CRITICAL | ✅ Cron diário |
| `CONTRACT_EXPIRED` | `endDate` atingida sem renovação | CRITICAL | ✅ Cron |
| `DEPOSIT_DUE` | Caução não paga em 15 dias após contrato | WARNING | ✅ Cron |
| `BUDGET_EXCEEDED` | Despesa real > orçamento em +15% | WARNING | ✅ Ao criar despesa |
| `NEGATIVE_BALANCE` | Saldo projectado negativo em 30 dias | CRITICAL | ✅ Cron diário |
| `RECONCILIATION_MISMATCH` | Saldo caixa ≠ saldo bancário > Kz 1.000 | WARNING | ✅ Reconciliação |
| `CUSTOM` | Criado manualmente por ADMIN | Configurável | ❌ Manual |

---

## 2. Ciclo de Vida do Alerta

```
ACTIVE → ACKNOWLEDGED (ADMIN viu) → RESOLVED (problema resolvido)
       → SNOOZED (adiar X dias)   → ACTIVE (quando snooze expira)
```

---

## 3. Detalhes por Tipo

### PAYMENT_OVERDUE

**Gatilhos:**
- `dueDate` + 1 dia → alerta criado (WARNING)
- `dueDate` + 30 dias → severidade escalada para CRITICAL
- `dueDate` + 60 dias → email automático para ADMIN + FINANCEIRO

**Dados do alerta:**
```
companyId, invoiceId, amount (valor em aberto), dueDate
```

**Resolução automática:** quando `Invoice.status = PAID`

---

### CONTRACT_EXPIRING

**Gatilhos (cron diário, executado às 07:00 África/Luanda):**
- `endDate - 60 dias` → INFO (notificação interna)
- `endDate - 30 dias` → WARNING + email ao gestor da conta
- `endDate - 7 dias` → CRITICAL + email ao ADMIN + ao cliente

**Dados do alerta:**
```
companyId, contractId, endDate, autoRenew, monthlyValue
```

**Resolução:**
- Renovação do contrato → alerta resolvido automaticamente
- Rescisão confirmada → alerta resolvido manualmente (ADMIN)

---

### NEGATIVE_BALANCE

**Gatilho:** cron diário analisa projecção de `CashMovement` para os próximos 30 dias. Se saldo projectado < 0 em qualquer dia:

```
FinancialAlert {
  type:     NEGATIVE_BALANCE,
  severity: CRITICAL,
  title:    "Saldo projectado negativo",
  message:  "O saldo projectado atingirá Kz -XX.XXX em DD/MM/YYYY",
  dueDate:  data em que o saldo fica negativo,
  amount:   valor negativo projectado
}
```

---

### BUDGET_EXCEEDED

**Gatilho:** ao criar ou aprovar uma `Expense`, o sistema compara o total de despesas do centro de custo no mês corrente com o `CostCenter.budget`:

```
if (totalMes / budget > 1.15) → WARNING
if (totalMes / budget > 1.30) → CRITICAL
```

**Dados do alerta:**
```
costCenterId, budget (orçado), totalMes (real), variação (%)
```

---

## 4. Notificações por Email (Resend)

| Alerta | Destinatário | Frequência |
|---|---|---|
| `PAYMENT_OVERDUE` (WARNING) | FINANCEIRO | 1x (na criação) |
| `PAYMENT_OVERDUE` (+30d) | ADMIN + FINANCEIRO | 1x ao escalar |
| `CONTRACT_EXPIRING` (30d) | Gestor da conta | 1x |
| `CONTRACT_EXPIRING` (7d) | ADMIN + cliente | 1x |
| `NEGATIVE_BALANCE` | ADMIN | 1x (+ repetição semanal se não resolvido) |
| `BUDGET_EXCEEDED` (CRITICAL) | ADMIN + FINANCEIRO | 1x |

---

## 5. Dashboard de Alertas

```
Alertas Activos: 5
  CRITICAL: 2  →  [CONTRACT_EXPIRING] Empresa Alpha — expira em 7 dias
                   [NEGATIVE_BALANCE] Saldo projectado negativo em 22/08
  WARNING:  2  →  [PAYMENT_OVERDUE] Empresa Beta — 35 dias em atraso
                   [BUDGET_EXCEEDED] Centro TI — 118% do orçamento
  INFO:     1  →  [CONTRACT_EXPIRING] Empresa Gamma — expira em 55 dias
```

**RBAC de alertas:**
- `ADMIN`: vê todos os alertas
- `FINANCEIRO`: vê alertas financeiros (PAYMENT_OVERDUE, NEGATIVE_BALANCE, BUDGET_EXCEEDED)
- `COMERCIAL`: vê apenas alertas das suas empresas (CONTRACT_EXPIRING dos seus clientes)
- `VIEWER`: sem acesso a alertas

---

## 6. API de Alertas

```
GET  /api/erp/alerts          → listar alertas activos (com filtros)
GET  /api/erp/alerts/:id      → detalhe
PATCH /api/erp/alerts/:id     → acknowledge | resolve | snooze
POST /api/erp/alerts          → criar alerta manual (ADMIN)
```

---

*VD Platform — ERP — Alertas Financeiros — Sprint ERP-0*
