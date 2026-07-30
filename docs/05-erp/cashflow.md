# ERP — Fluxo de Caixa (Cash Flow)

> **Volume:** 02 — ERP  
> **Documento:** cashflow.md  
> **Estado:** ✅ Implementado — Sprint ERP-5 (29 Jul 2026)

---

## 1. Visão

O fluxo de caixa é calculado a partir de `CashMovement` — uma sequência de movimentos reais e projectados que permite conhecer a posição de tesouraria a qualquer momento e projectar até 90 dias.

---

## 2. Tipos de Movimento

| Tipo | Descrição | Origem |
|---|---|---|
| `INFLOW` | Entrada de caixa real | Payment confirmado |
| `OUTFLOW` | Saída de caixa real | Expense paga |
| `TRANSFER` | Transferência entre contas | Manual |
| `PROJECTED` | Movimento futuro estimado | RentSchedule, Expense recorrente |

---

## 3. Cálculo do Saldo

O `CashMovement.balance` é calculado de forma acumulada:

```
balance[n] = balance[n-1] + amount (se INFLOW)
           = balance[n-1] - amount (se OUTFLOW)
           = balance[n-1]          (se TRANSFER — depende da conta)
```

O saldo inicial é definido manualmente pelo ADMIN (saldo bancário de abertura do período).

---

## 4. Projecção de Fluxo de Caixa

O sistema gera automaticamente `CashMovement` com `isProjected=true`:

**Fontes de projecção:**

| Fonte | Tipo | Base de Cálculo |
|---|---|---|
| RentSchedule PENDING | INFLOW projectado | `dueDate` + `amount` |
| RoomBooking CONFIRMED | INFLOW projectado | `startTime` + `totalPrice` |
| Expense recorrente APPROVED | OUTFLOW projectado | `dueDate` + `amount` |
| Contract.monthlyValue | INFLOW projectado | Para contratos sem RentSchedule |

**Horizonte de projecção:** 30 / 60 / 90 dias (configurável).

---

## 5. Vistas de Cash Flow

### 5.1 Vista Diária

```
Data       | Entrada    | Saída      | Saldo
-----------|------------|------------|----------
2026-08-01 | Kz 120.000 | Kz  45.000 | Kz 825.000
2026-08-02 | —          | Kz 250.000 | Kz 575.000 (renda imóvel)
2026-08-05 | Kz  60.000 | —          | Kz 635.000
...
```

### 5.2 Vista Semanal

Agrega os movimentos por semana. Útil para gestão de tesouraria de curto prazo.

### 5.3 Vista Mensal

Agrega por mês. Inclui linha de comparação com mês anterior e projecção do próximo.

### 5.4 Projecção 30/60/90 dias

Combina movimentos reais já registados com movimentos projectados (`isProjected=true`), indicando visualmente quais são estimativas.

---

## 6. Alerta de Saldo Negativo

Se `CashMovement.balance` projectado atingir valor negativo nos próximos 30 dias, é criado automaticamente um `FinancialAlert`:

```
tipo:       NEGATIVE_BALANCE
severidade: CRITICAL
título:     "Saldo projectado negativo em 15/08/2026"
mensagem:   "O saldo projectado atingirá Kz -32.000 na semana de 11–15 Agosto 2026."
```

---

## 7. Reconciliação Bancária

**Processo mensal (ADMIN/FINANCEIRO):**

```
1. Importar extracto BCS (CSV ou manual)
2. Sistema compara:
   - Saldo calculado via CashMovement
   - Saldo real do extracto bancário
3. Divergência > Kz 1.000:
   → FinancialAlert RECONCILIATION_MISMATCH
   → ADMIN identifica e regista ajuste manual
4. Após reconciliação:
   → CashMovement { type: ADJUSTMENT, description: "Reconciliação Agosto 2026" }
   → FinancialAlert resolvido
```

---

## 8. KPIs de Cash Flow no Dashboard

```
Saldo actual (hoje)
Saldo projectado (30d)
Saldo projectado (90d)
Entradas do mês corrente
Saídas do mês corrente
Variação face ao mês anterior (%)
Burn rate médio (últimos 3 meses)
Runway (meses de operação com saldo actual)
```

---

*VD Platform — ERP — Fluxo de Caixa — Sprint ERP-0*
