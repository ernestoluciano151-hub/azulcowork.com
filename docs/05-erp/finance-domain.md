# ERP — Domínio Financeiro

> **Volume:** 02 — ERP  
> **Documento:** finance-domain.md  
> **Estado:** 📝 Especificação — Sprint ERP-0  
> **Última actualização:** Julho 2026

---

## 1. Visão do Domínio

O domínio financeiro do Azul Coworking cobre três fluxos económicos distintos:

**Receitas (Accounts Receivable)**
- Mensalidades de coworking (contratos recorrentes)
- Reservas de salas de reunião (one-off)
- Serviços adicionais (impressão, café, domiciliação, etc.)
- Taxa de adesão (onboarding)

**Despesas (Accounts Payable)**
- Renda do imóvel (Edifício 18, Bairro Azul)
- Utilidades: electricidade, água, internet
- Salários e processamento de vencimentos
- Fornecedores: limpeza, manutenção, segurança
- Marketing e comunicação
- Infraestrutura tecnológica: servidores, domínios, licenças
- Seguros e licenças obrigatórias

**Fluxo de Caixa (Cash Flow)**
- Posição diária de caixa (real + projectada)
- Reconciliação bancária
- Projecção 30/60/90 dias

---

## 2. Entidades do Domínio

### Agregado: Contract (Contrato)

O contrato é o coração do modelo de receita recorrente. Um contrato liga uma `Company` (cliente) a um posto de coworking ou serviço.

```
Contract
  ├── companyId          FK → Company (SSoT)
  ├── planType           FLEX | HOT_DESK | DEDICATED | PRIVATE_OFFICE | VIRTUAL
  ├── startDate
  ├── endDate
  ├── monthlyValue       Kz — valor base mensal
  ├── depositAmount      Kz — caução paga na adesão
  ├── depositStatus      PENDING | PAID | RETURNED | FORFEITED
  ├── status             DRAFT | ACTIVE | SUSPENDED | TERMINATED | EXPIRED
  ├── autoRenew          boolean
  ├── renewalNoticeDays  número de dias de aviso antes do fim
  ├── adjustmentRules    JSON — regras de reajuste (ex.: IPC anual)
  ├── attachments        String[] — URLs PDF no Cloudinary
  └── RentSchedule[]     parcelas mensais geradas

RentSchedule (parcela mensal)
  ├── contractId         FK → Contract
  ├── companyId          FK → Company
  ├── dueDate            data de vencimento
  ├── amount             Kz
  ├── status             PENDING | INVOICED | PAID | OVERDUE | WAIVED | CANCELLED
  └── invoiceId?         FK → Invoice (quando faturada)
```

### Agregado: Invoice (Fatura)

Unifica faturas de coworking e salas numa entidade única, discriminada por `type`.

```
Invoice
  ├── number             FT-CWORK-2026-000001 | FT-SALA-2026-000001
  ├── type               COWORKING | ROOM | SERVICE | MIXED | EXPENSE_REIMBURSEMENT
  ├── companyId?         FK → Company (pode ser null para reservas de particulares)
  ├── bookingId?         FK → RoomBooking
  ├── contractId?        FK → Contract
  ├── status             DRAFT | ISSUED | SENT | PAID | OVERDUE | CANCELLED | VOID
  ├── issueDate
  ├── dueDate
  ├── subtotal           Kz
  ├── taxAmount          Kz (IVA Angola: 14%)
  ├── total              Kz
  ├── pdfUrl?            Cloudinary
  ├── sentAt?
  ├── paidAt?
  ├── items              InvoiceItem[]
  └── payments           Payment[]

InvoiceItem
  ├── invoiceId
  ├── description
  ├── quantity
  ├── unitPrice          Kz
  ├── total              Kz
  ├── accountCode        código do plano de contas (ex.: "7111")
  └── costCenterId?      FK → CostCenter
```

### Agregado: Payment (Pagamento)

```
Payment
  ├── invoiceId?         FK → Invoice
  ├── companyId?         FK → Company
  ├── amount             Kz
  ├── method             BANK_TRANSFER | CASH | CHECK | MULTICAIXA | TPA | CREDITO
  ├── reference          referência bancária ou número de operação
  ├── paidAt             data efectiva do pagamento
  ├── confirmedAt?       data de confirmação (após validação)
  ├── confirmedBy?       FK → AdminUser
  ├── status             PENDING | CONFIRMED | REJECTED | REFUNDED
  └── receiptUrl?        URL do recibo PDF
```

### Entidade: FinancialLedger (Razão Geral)

**Imutável.** Nunca editada. Nunca eliminada. Cada lançamento é criado uma vez.

```
FinancialLedger
  ├── entryDate          data do lançamento
  ├── description        descrição legível
  ├── type               DEBIT | CREDIT
  ├── amount             Kz (sempre positivo)
  ├── accountCode        código da conta (plano de contas)
  ├── costCenterId?      FK → CostCenter
  ├── companyId?         FK → Company
  ├── invoiceId?         FK → Invoice
  ├── paymentId?         FK → Payment
  ├── expenseId?         FK → Expense
  ├── reference          identificador único do lançamento
  └── createdBy          FK → AdminUser (ou "SYSTEM")
```

### Entidade: Expense (Despesa)

```
Expense
  ├── categoryId         FK → ExpenseCategory
  ├── costCenterId?      FK → CostCenter
  ├── supplierName?      nome do fornecedor
  ├── description
  ├── amount             Kz
  ├── dueDate
  ├── paidAt?
  ├── status             PENDING | APPROVED | PAID | REJECTED | CANCELLED
  ├── recurrence         NONE | MONTHLY | QUARTERLY | ANNUAL
  ├── receiptUrl?        URL do documento de suporte
  ├── approvedBy?        FK → AdminUser
  └── ledgerEntries      FinancialLedger[]
```

### Entidade: CashMovement (Movimento de Caixa)

```
CashMovement
  ├── date               data do movimento
  ├── type               INFLOW | OUTFLOW | TRANSFER | PROJECTED
  ├── amount             Kz
  ├── description
  ├── source             PAYMENT | EXPENSE | CONTRACT | BOOKING | MANUAL
  ├── sourceId?          ID do objecto de origem
  ├── isProjected        boolean — movimento real ou projecção
  ├── bankAccount?       conta bancária (string, referência ao BCS IBAN)
  └── balance            Kz — saldo acumulado após este movimento
```

---

## 3. Regras de Negócio Fundamentais

### BR-FIN-001 — Ledger Imutável
O `FinancialLedger` é append-only. Nenhum lançamento pode ser editado ou eliminado. Correcções são feitas por estorno (lançamento contrário) com referência ao lançamento original.

### BR-FIN-002 — Partida Dupla
Todo lançamento financeiro gera exactamente dois registos no Ledger: um DEBIT e um CREDIT de valor igual. A soma de todos os lançamentos deve ser zero.

### BR-FIN-003 — Fatura antes de Recibo
Um `Receipt` só pode ser emitido após confirmação do `Payment` correspondente. Um `Payment` só pode ser confirmado se existir uma `Invoice` associada (excepto pagamentos ad-hoc aprovados por ADMIN).

### BR-FIN-004 — Numeração Atómica
Números de documentos (FT-*, REC-*, NL-*) são gerados com `DocumentCounter` em `SELECT ... FOR UPDATE` dentro de `$transaction`. Nunca em paralelo fora de transacção.

### BR-FIN-005 — IVA Angola
Taxa de IVA aplicável: **14%** (Lei n.º 17/19 do Imposto sobre o Valor Acrescentado de Angola). Faturas emitidas para empresas com NIF válido incluem IVA discriminado. Isenções aplicáveis apenas com documento de suporte aprovado.

### BR-FIN-006 — Caução
A caução é tratada como passivo até devolução ou utilização. Nunca é registada como receita no momento da recepção.

### BR-FIN-007 — Contrato DRAFT
Um contrato em estado `DRAFT` não gera parcelas de `RentSchedule`. A geração ocorre na transição `DRAFT → ACTIVE`.

### BR-FIN-008 — Despesa Aprovada
Despesas acima de **Kz 50.000** requerem aprovação de `ADMIN` antes de registo no Ledger. Despesas recorrentes aprovadas uma vez não necessitam de re-aprovação mensal.

### BR-FIN-009 — Reconciliação
O saldo de caixa calculado via `CashMovement.balance` deve ser reconciliado mensalmente com o saldo bancário real (BCS). Divergências > Kz 1.000 geram `FinancialAlert` automático.

### BR-FIN-010 — Fatura Void
Uma fatura apenas pode ser anulada (`VOID`) se não tiver pagamentos confirmados. A anulação gera estorno no Ledger e `TimelineEntry`.

---

## 4. Ciclo de Vida de um Cliente Financeiro

```
Lead (CRM)
  → Qualificado → PROPOSTA enviada
  → Contrato assinado (Contract.status = ACTIVE)
  → RentSchedule gerado (D+1)
  → Invoice emitida mensalmente (dia 1 do mês)
  → Pagamento recebido → Ledger actualizado → Recibo emitido
  → [se não pago em 30 dias] → FinancialAlert OVERDUE
  → [se não pago em 60 dias] → Processo de cobrança
  → Contrato rescindido → Caução devolvida / retida
  → Company marcada INACTIVE (CRM)
```

---

## 5. Integração com CRM

| Evento CRM | Acção ERP |
|---|---|
| `crm.company.created` | Preparar perfil financeiro (sem acção automática) |
| `crm.deal.won` | Notificar equipa para criar contrato |
| `crm.company.deleted` | Verificar ausência de contratos activos |
| `crm.contact.primaryChanged` | Actualizar destinatário de faturas |

---

## 6. Integração com Reservas (Salas)

| Evento Reservas | Acção ERP |
|---|---|
| `booking.confirmed` | Gerar `Invoice` com `type=ROOM` automaticamente |
| `booking.cancelled` | Verificar política de cancelamento → emitir `NL` (Nota de Liquidação) |
| `booking.checkedIn` | Confirmar presença (sem acção financeira) |
| `booking.noShow` | Manter fatura conforme política |

---

*VD Platform — ERP — Domínio Financeiro — Sprint ERP-0*
