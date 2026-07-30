# ERP — Pagamentos

> **Volume:** 02 — ERP  
> **Documento:** payments.md  
> **Estado:** ✅ Implementado — Sprint ERP-3 (28 Jul 2026)

---

## 1. Visão

O módulo de pagamentos regista, valida e confirma todos os recebimentos de clientes. Um pagamento só é considerado efectivo após confirmação por um administrador ou validação automática (quando integrado com gateway bancário).

---

## 2. Métodos de Pagamento

| Método | Código | Verificação |
|---|---|---|
| Transferência bancária | `BANK_TRANSFER` | Manual (comprovativo) |
| Numerário | `CASH` | Manual (recibo de caixa) |
| Cheque | `CHECK` | Manual (após compensação) |
| Multicaixa Express | `MULTICAIXA` | Automática (futura integração) |
| TPA (Terminal) | `TPA` | Manual (comprovativo) |
| Crédito interno | `CREDITO` | Aprovação ADMIN |

---

## 3. Ciclo de Vida do Pagamento

```
PENDING → CONFIRMED → (gera Recibo + Ledger)
        → REJECTED  → (fatura volta a ISSUED/OVERDUE)
        → REFUNDED  → (estorno no Ledger)
```

**Fluxo de confirmação:**

```
1. Cliente efectua pagamento (banco, caixa, TPA)
2. ADMIN regista Payment { invoiceId, amount, method, reference, paidAt }
3. ADMIN confirma após validar comprovativo
4. Sistema (em $transaction):
   a. Payment.status = CONFIRMED, confirmedAt = now()
   b. Invoice.status = PAID (se amount = invoice.total)
                     = PARTIALLY_PAID (se amount < invoice.total)
   c. Criar FinancialLedger: DEBIT 1201, CREDIT 211x
   d. Gerar Recibo PDF (REC-YYYY-NNNNNN)
   e. Actualizar CashMovement (INFLOW)
   f. Publicar erp.payment.confirmed
   g. Criar TimelineEntry na Company
   h. Enviar recibo por email (Resend)
   i. Resolver FinancialAlert PAYMENT_OVERDUE se existia
```

---

## 4. Confirmação de Pagamento

**Regras:**
- BR-PAY-001: Apenas `ADMIN` e `FINANCEIRO` podem confirmar pagamentos.
- BR-PAY-002: O valor confirmado pode ser inferior ao total da fatura (pagamento parcial). Nesse caso, a fatura fica `PARTIALLY_PAID` e é criado `FinancialAlert`.
- BR-PAY-003: O sistema não aceita pagamentos em excesso sem aprovação explícita de ADMIN. Excesso → `CREDITO` a favor do cliente.
- BR-PAY-004: Cheques só são confirmados após compensação bancária (mínimo 3 dias úteis).

---

## 5. Recibo de Pagamento

**Geração automática** após `Payment.status = CONFIRMED`:

```
Número:     REC-YYYY-NNNNNN
Data:       confirmedAt
Valor:      Payment.amount
Método:     Payment.method (por extenso)
Referência: Payment.reference
Fatura:     Invoice.number
Cliente:    Company.name + NIF
```

O recibo é enviado por email para o mesmo destinatário da fatura.

---

## 6. Reembolso (Refund)

**Processo (ADMIN):**
1. Seleccionar `Payment` com `status=CONFIRMED`
2. Justificar motivo do reembolso
3. Sistema (em `$transaction`):
   a. `Payment.status = REFUNDED`
   b. Criar lançamento de estorno no `FinancialLedger`
   c. Actualizar `Invoice.status` (reverter para ISSUED ou VOID conforme caso)
   d. Actualizar `CashMovement` (OUTFLOW de reembolso)
   e. Publicar `erp.payment.refunded`
   f. Criar `TimelineEntry`
   g. Enviar notificação por email

---

## 7. Relatório de Pagamentos em Atraso

Gerado automaticamente pelo cron diário:

```
Critério: Invoice.status = OVERDUE
Agrupado: por Company, por antiguidade (30d / 60d / 90d / +90d)
Acção:    Criar/actualizar FinancialAlert PAYMENT_OVERDUE
          Enviar relatório de inadimplência para ADMIN/FINANCEIRO
```

---

## 8. Integração com CashFlow

Cada pagamento confirmado cria automaticamente um `CashMovement`:

```
CashMovement {
  date:        Payment.paidAt,
  type:        INFLOW,
  amount:      Payment.amount,
  description: "Pagamento — " + Invoice.number,
  source:      PAYMENT,
  sourceId:    Payment.id,
  isProjected: false,
  bankAccount: "BCS-MAIN"
}
```

---

## 9. Dados Bancários para Pagamento

```
Banco:  BCS (Banco de Comércio e Serviços)
IBAN:   AO06007000000212870210113
SWIFT:  CDTSAOLU
Ref.:   Número da fatura (FT-CWORK-2026-NNNNNN)
```

---

*VD Platform — ERP — Pagamentos — Sprint ERP-0*
