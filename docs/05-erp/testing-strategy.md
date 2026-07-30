# ERP — Estratégia de Testes

> **Volume:** 02 — ERP  
> **Estado:** 📝 Especificação — Sprint ERP-0  
> **Framework:** Vitest 4.1.10 (já configurado)  
> **Meta de cobertura:** ≥ 70% nos módulos financeiros críticos (acima do P0 target)

---

## 1. Princípio

Módulos financeiros têm impacto directo em dinheiro real. A estratégia de testes é mais exigente do que nos módulos operacionais.

**Regra Constitucional:** Nenhuma feature ERP é considerada concluída sem testes que cubram os caminhos críticos e os edge cases financeiros.

---

## 2. Módulos Críticos (Cobertura ≥ 80%)

| Módulo | Ficheiro de teste |
|---|---|
| Ledger (partida dupla) | `src/__tests__/unit/financial-ledger.test.ts` |
| Billing Engine (cálculo IVA, numeração) | `src/__tests__/unit/billing-engine.test.ts` |
| Contract State Machine | `src/__tests__/unit/contract-state-machine.test.ts` |
| RentSchedule Generator | `src/__tests__/unit/rent-schedule-generator.test.ts` |
| Cash Flow Projector | `src/__tests__/unit/cashflow-projector.test.ts` |
| Alert Engine | `src/__tests__/unit/alert-engine.test.ts` |
| ERP Validators | `src/__tests__/unit/erp-validators.test.ts` |

---

## 3. Casos de Teste por Módulo

### 3.1 Ledger Tests

```typescript
describe("FinancialLedger", () => {
  it("deve criar par DEBIT/CREDIT para pagamento confirmado")
  it("deve manter balance invariante: sum(DEBIT) = sum(CREDIT)")
  it("deve bloquear UPDATE de lançamento existente")
  it("deve bloquear DELETE de lançamento existente")
  it("deve criar estorno com referência ao lançamento original")
  it("deve rejeitar amount <= 0")
  it("deve registar accountCode válido do plano de contas")
})
```

### 3.2 Billing Engine Tests

```typescript
describe("BillingEngine", () => {
  it("deve calcular IVA 14% correctamente")
  it("deve calcular subtotal = total / 1.14")
  it("deve gerar número FT-CWORK-YYYY-NNNNNN atomicamente")
  it("deve gerar número FT-SALA-YYYY-NNNNNN para reservas")
  it("deve bloquear emissão de fatura com items vazios")
  it("deve bloquear emissão de fatura com total = 0")
  it("deve somar items correctamente: qty * unitPrice")
  it("deve calcular total = subtotal + taxAmount")
  it("deve gerar fatura MIXED com items de tipos diferentes")
  it("deve respeitar policy dueDate: issueDate + 30 dias")
  it("não deve duplicar número de fatura em concorrência")
})
```

### 3.3 Contract State Machine Tests

```typescript
describe("ContractStateMachine", () => {
  it("DRAFT → ACTIVE: deve gerar RentSchedules")
  it("DRAFT → ACTIVE: deve bloquear se companyId inválido")
  it("ACTIVE → SUSPENDED: deve preservar RentSchedules pendentes")
  it("ACTIVE → TERMINATED: deve cancelar RentSchedules futuros")
  it("ACTIVE → EXPIRED: deve ser feito pelo cron, não manualmente")
  it("SUSPENDED → ACTIVE: deve reactivar RentSchedules")
  it("TERMINATED → qualquer: deve ser bloqueado (terminal)")
  it("deve bloquear endDate <= startDate")
  it("deve bloquear monthlyValue <= 0")
})
```

### 3.4 RentSchedule Generator Tests

```typescript
describe("RentScheduleGenerator", () => {
  it("deve gerar parcela para cada mês entre startDate e endDate")
  it("deve usar dia 1 do mês como dueDate")
  it("deve aplicar regra BR-CONT-001 para primeiro mês")
  it("deve gerar 12 meses para contrato sem endDate + autoRenew")
  it("deve gerar RentSchedules com amount = contract.monthlyValue")
  it("não deve gerar duplicados em reactivação")
  it("deve ser idempotente")
})
```

### 3.5 CashFlow Projector Tests

```typescript
describe("CashFlowProjector", () => {
  it("deve incluir RentSchedules PENDING como INFLOW projectado")
  it("deve incluir Expenses recorrentes como OUTFLOW projectado")
  it("deve calcular saldo acumulado correctamente")
  it("deve detectar saldo negativo projectado")
  it("deve criar FinancialAlert quando saldo projectado < 0")
  it("deve distinguir movimentos reais de projecções")
  it("deve ignorar RentSchedules PAID na projecção")
})
```

### 3.6 Alert Engine Tests

```typescript
describe("AlertEngine", () => {
  it("deve criar PAYMENT_OVERDUE após dueDate + 1 dia")
  it("deve escalar para CRITICAL após dueDate + 30 dias")
  it("deve criar CONTRACT_EXPIRING 60/30/7 dias antes")
  it("deve criar DEPOSIT_DUE se caução não paga em 15 dias")
  it("deve criar BUDGET_EXCEEDED se real > orçado em 15%")
  it("deve criar NEGATIVE_BALANCE se saldo projectado < 0")
  it("deve resolver PAYMENT_OVERDUE quando invoice é paga")
  it("deve resolver CONTRACT_EXPIRING quando contrato é renovado")
  it("não deve criar alertas duplicados para o mesmo gatilho")
})
```

### 3.7 ERP Validators Tests

```typescript
describe("ERPValidators", () => {
  it("validateCreateContract: rejeita monthlyValue <= 0")
  it("validateCreateContract: rejeita endDate <= startDate")
  it("validateCreateInvoice: rejeita items vazios")
  it("validateCreateInvoice: rejeita dueDate no passado")
  it("validatePayment: rejeita amount <= 0")
  it("validatePayment: rejeita paidAt no futuro")
  it("validateExpense: rejeita amount <= 0")
  it("validateExpense: rejeita categoryId inválido")
  it("validateIVA: 14% calculado correctamente com arredondamento")
})
```

---

## 4. Testes de Integração

### 4.1 Fluxo Completo: Contrato → Fatura → Pagamento → Ledger

```typescript
it("fluxo completo de receita", async () => {
  // 1. Criar Company
  // 2. Criar Contract (DRAFT)
  // 3. Activar Contract → verificar RentSchedules criados
  // 4. Processar faturação mensal → verificar Invoice ISSUED
  // 5. Registar Payment → verificar Payment PENDING
  // 6. Confirmar Payment → verificar:
  //    - Invoice.status = PAID
  //    - FinancialLedger entries (DEBIT 1201, CREDIT 2111)
  //    - CashMovement INFLOW criado
  //    - Receipt gerado
  //    - FinancialAlert PAYMENT_OVERDUE resolvido (se existia)
})
```

### 4.2 Fluxo de Despesa: Registo → Aprovação → Pagamento → Ledger

```typescript
it("fluxo completo de despesa", async () => {
  // 1. Criar Expense (PENDING, amount > 50.000)
  // 2. Aprovar (ADMIN) → verificar APPROVED
  // 3. Pagar → verificar:
  //    - Expense.status = PAID
  //    - FinancialLedger (DEBIT 6xxx, CREDIT 1201)
  //    - CashMovement OUTFLOW
})
```

### 4.3 Fluxo de Alerta: Contrato Expirando

```typescript
it("alertas de contrato expirando", async () => {
  // 1. Criar Contract com endDate = today + 30 dias
  // 2. Executar cron de alertas
  // 3. Verificar FinancialAlert CONTRACT_EXPIRING criado (WARNING)
  // 4. Avançar data para endDate - 7 dias
  // 5. Executar cron → verificar escalada para CRITICAL
})
```

---

## 5. Testes de Concorrência

```typescript
describe("Concorrência financeira", () => {
  it("não deve gerar duplicados de número de fatura em requests paralelos")
  it("não deve confirmar o mesmo pagamento duas vezes")
  it("não deve criar RentSchedules duplicados em activação paralela")
  it("ledger deve manter consistência sob carga concorrente")
})
```

---

## 6. Testes de Regressão P0

Garantir que o ERP não quebra funcionalidades da Fase P0:

- Sistema de autenticação e RBAC
- Gestão de salas e reservas
- Histórico de leads
- Numeração de documentos existente (FT-SALA, FT-CWORK já existente)

---

## 7. Critérios de Qualidade (Quality Gate ERP)

```
GATE 1 (pre-commit):  lint + tsc + testes afectados (0 falhas)
GATE 2 (pre-merge):   build completo + suite completa + cobertura ≥ 70%
GATE 3 (pre-deploy):  smoke tests ERP em staging + rollback planeado
```

**Cobertura mínima por módulo:**
- `financial-ledger.ts`: ≥ 95%
- `billing-engine.ts`: ≥ 90%
- `contract-state-machine.ts`: ≥ 90%
- `erp-validators.ts`: ≥ 85%
- `cashflow-projector.ts`: ≥ 80%
- `alert-engine.ts`: ≥ 80%

---

*VD Platform — ERP — Estratégia de Testes — Sprint ERP-0*
