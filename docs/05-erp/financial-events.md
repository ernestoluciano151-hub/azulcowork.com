# ERP — Event Catalog Financeiro

> **Volume:** 02 — ERP  
> **Documento:** financial-events.md  
> **Estado:** 📝 Especificação — Sprint ERP-0  
> **Regra:** Eventos são publicados SOMENTE após commit da transacção (ADR-003)

---

## 1. Catálogo de Eventos

### Contratos

| Evento | Quando | Payload |
|---|---|---|
| `erp.contract.created` | Contrato criado em DRAFT | `{ contractId, companyId, planType, monthlyValue }` |
| `erp.contract.activated` | DRAFT → ACTIVE | `{ contractId, companyId, startDate, scheduleCount }` |
| `erp.contract.suspended` | ACTIVE → SUSPENDED | `{ contractId, companyId, reason }` |
| `erp.contract.reactivated` | SUSPENDED → ACTIVE | `{ contractId, companyId }` |
| `erp.contract.terminated` | → TERMINATED | `{ contractId, companyId, reason, terminatedAt }` |
| `erp.contract.expired` | endDate atingida | `{ contractId, companyId, endDate }` |
| `erp.contract.renewed` | Renovação automática | `{ contractId, companyId, newEndDate }` |
| `erp.contract.valueAdjusted` | Reajuste de valor | `{ contractId, oldValue, newValue, reason }` |
| `erp.contract.depositPaid` | Caução confirmada | `{ contractId, companyId, amount }` |
| `erp.contract.depositReturned` | Caução devolvida | `{ contractId, companyId, amount }` |

### Faturas

| Evento | Quando | Payload |
|---|---|---|
| `erp.invoice.created` | Invoice criada (DRAFT) | `{ invoiceId, companyId, type, total }` |
| `erp.invoice.issued` | DRAFT → ISSUED | `{ invoiceId, number, companyId, total, dueDate }` |
| `erp.invoice.sent` | Email enviado | `{ invoiceId, sentTo, sentAt }` |
| `erp.invoice.paid` | Totalmente paga | `{ invoiceId, companyId, paidAt, amount }` |
| `erp.invoice.partiallyPaid` | Pagamento parcial | `{ invoiceId, paidAmount, remaining }` |
| `erp.invoice.overdue` | dueDate ultrapassada | `{ invoiceId, companyId, daysOverdue, amount }` |
| `erp.invoice.voided` | Anulada | `{ invoiceId, reason, voidedBy }` |
| `erp.invoice.cancelled` | Cancelada | `{ invoiceId, reason }` |

### Pagamentos

| Evento | Quando | Payload |
|---|---|---|
| `erp.payment.registered` | Payment criado (PENDING) | `{ paymentId, invoiceId, amount, method }` |
| `erp.payment.confirmed` | PENDING → CONFIRMED | `{ paymentId, invoiceId, companyId, amount, confirmedBy }` |
| `erp.payment.rejected` | PENDING → REJECTED | `{ paymentId, reason }` |
| `erp.payment.refunded` | CONFIRMED → REFUNDED | `{ paymentId, amount, reason }` |
| `erp.receipt.generated` | Recibo PDF criado | `{ paymentId, receiptNumber, receiptUrl }` |
| `erp.receipt.sent` | Recibo enviado por email | `{ paymentId, sentTo }` |

### Ledger

| Evento | Quando | Payload |
|---|---|---|
| `erp.ledger.entry` | Novo lançamento criado | `{ ledgerId, type, amount, accountCode, reference }` |
| `erp.ledger.reversed` | Estorno registado | `{ newLedgerId, originalLedgerId, reason }` |

### Despesas

| Evento | Quando | Payload |
|---|---|---|
| `erp.expense.created` | Despesa criada | `{ expenseId, categoryId, amount }` |
| `erp.expense.approved` | PENDING → APPROVED | `{ expenseId, approvedBy }` |
| `erp.expense.rejected` | → REJECTED | `{ expenseId, reason, rejectedBy }` |
| `erp.expense.paid` | → PAID | `{ expenseId, amount, paidAt }` |

### Alertas

| Evento | Quando | Payload |
|---|---|---|
| `erp.alert.created` | Alerta criado | `{ alertId, type, severity, companyId? }` |
| `erp.alert.escalated` | Severidade aumentada | `{ alertId, oldSeverity, newSeverity }` |
| `erp.alert.acknowledged` | ACTIVE → ACKNOWLEDGED | `{ alertId, acknowledgedBy }` |
| `erp.alert.resolved` | → RESOLVED | `{ alertId, resolvedBy }` |

### Caixa

| Evento | Quando | Payload |
|---|---|---|
| `erp.cashflow.movement` | CashMovement criado | `{ movementId, type, amount, balance, date }` |
| `erp.cashflow.negativeProjected` | Saldo projectado < 0 | `{ date, projectedBalance }` |
| `erp.cashflow.reconciled` | Reconciliação concluída | `{ period, difference, adjustmentId? }` |

---

## 2. Handlers de Eventos

### Handler: erp.payment.confirmed

```typescript
async function onPaymentConfirmed(payload: PaymentConfirmedPayload) {
  // 1. Gerar recibo (PDF)
  await generateReceipt(payload.paymentId);
  // 2. Criar CashMovement INFLOW
  await createCashMovement({ type: "INFLOW", ...payload });
  // 3. Resolver alertas PAYMENT_OVERDUE da invoice
  await resolveOverdueAlerts(payload.invoiceId);
  // 4. Publicar erp.receipt.generated
  // 5. Enviar recibo por email (Resend)
  await sendReceiptEmail(payload);
  // 6. Criar TimelineEntry na Company
  await createTimelineEntry(payload.companyId, "PAYMENT_CONFIRMED", payload);
}
```

### Handler: erp.contract.activated

```typescript
async function onContractActivated(payload: ContractActivatedPayload) {
  // 1. Gerar RentSchedules para o período do contrato
  await generateRentSchedules(payload.contractId);
  // 2. Criar TimelineEntry
  await createTimelineEntry(payload.companyId, "CONTRACT_ACTIVATED", payload);
  // 3. Actualizar Company.contractStatus = "ACTIVE"
  // 4. Criar FinancialAlert de caução (se depositAmount > 0 e depositStatus=PENDING)
  if (payload.depositAmount > 0) await createDepositAlert(payload);
}
```

### Handler: erp.invoice.overdue

```typescript
async function onInvoiceOverdue(payload: InvoiceOverduePayload) {
  // 1. Criar FinancialAlert PAYMENT_OVERDUE
  await createFinancialAlert({ type: "PAYMENT_OVERDUE", ...payload });
  // 2. Criar TimelineEntry na Company
  await createTimelineEntry(payload.companyId, "INVOICE_OVERDUE", payload);
  // 3. Enviar email de lembrete ao cliente (se 1ª vez)
  if (payload.daysOverdue === 1) await sendOverdueEmail(payload);
}
```

---

## 3. Integração com CRM Event Bus

O ERP consome eventos do CRM e vice-versa:

| Evento CRM | Handler ERP | Acção |
|---|---|---|
| `crm.deal.won` | `onDealWon` | Notificar equipa para criar contrato |
| `crm.company.deleted` | `onCompanyDeleted` | Verificar contratos activos (bloquear se existirem) |
| `crm.contact.primaryChanged` | `onPrimaryContactChanged` | Actualizar email de faturação |
| `booking.confirmed` | `onBookingConfirmed` | Gerar Invoice tipo ROOM |
| `booking.cancelled` | `onBookingCancelled` | Anular/ajustar Invoice via política |

---

*VD Platform — ERP — Event Catalog Financeiro — Sprint ERP-0*
