# ERP — Modelo de Dados

> **Volume:** 02 — ERP  
> **Documento:** data-model.md  
> **Estado:** ✅ Implementado — Sprint ERP-1 (28 Jul 2026)  
> **Nota:** Schema implementado em `prisma/schema.prisma`. Modelos prefixados com `Erp` para conviver com modelos legados (`Invoice`, `Payment`, `Expense`).  
> **Próximo passo:** Executar `npx prisma migrate dev --name erp-volume02` em ambiente com acesso à base de dados.

---

## 1. Princípios de Modelação

- `Company` continua a ser o pivot central (SSoT — ADR-016)
- Toda entidade financeira referencia `Company` por FK
- `FinancialLedger` é append-only (sem UPDATE, sem DELETE)
- Soft-delete via `deletedAt` nas entidades editáveis
- `$transaction` obrigatório em toda operação multi-tabela
- Índices em todas as FK e campos de filtro frequente

---

## 2. Schema Prisma (Proposto)

```prisma
// ────────────────────────────────────────────────────────────────────
// ENUMS
// ────────────────────────────────────────────────────────────────────

enum ContractStatus {
  DRAFT
  ACTIVE
  SUSPENDED
  TERMINATED
  EXPIRED
}

enum ContractPlanType {
  FLEX
  HOT_DESK
  DEDICATED
  PRIVATE_OFFICE
  VIRTUAL
  CUSTOM
}

enum DepositStatus {
  PENDING
  PAID
  RETURNED
  FORFEITED
}

enum RentScheduleStatus {
  PENDING
  INVOICED
  PAID
  OVERDUE
  WAIVED
  CANCELLED
}

enum InvoiceType {
  COWORKING
  ROOM
  SERVICE
  MIXED
  EXPENSE_REIMBURSEMENT
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  SENT
  PAID
  OVERDUE
  PARTIALLY_PAID
  CANCELLED
  VOID
}

enum PaymentMethod {
  BANK_TRANSFER
  CASH
  CHECK
  MULTICAIXA
  TPA
  CREDITO
}

enum PaymentStatus {
  PENDING
  CONFIRMED
  REJECTED
  REFUNDED
}

enum LedgerType {
  DEBIT
  CREDIT
}

enum ExpenseStatus {
  PENDING
  APPROVED
  PAID
  REJECTED
  CANCELLED
}

enum ExpenseRecurrence {
  NONE
  MONTHLY
  QUARTERLY
  ANNUAL
}

enum CashMovementType {
  INFLOW
  OUTFLOW
  TRANSFER
  PROJECTED
}

enum CashMovementSource {
  PAYMENT
  EXPENSE
  CONTRACT
  BOOKING
  MANUAL
  ADJUSTMENT
}

enum AlertType {
  PAYMENT_OVERDUE
  CONTRACT_EXPIRING
  CONTRACT_EXPIRED
  BUDGET_EXCEEDED
  NEGATIVE_BALANCE
  DEPOSIT_DUE
  RECONCILIATION_MISMATCH
  CUSTOM
}

enum AlertSeverity {
  INFO
  WARNING
  CRITICAL
}

enum AlertStatus {
  ACTIVE
  ACKNOWLEDGED
  RESOLVED
  SNOOZED
}

// ────────────────────────────────────────────────────────────────────
// CONTRACT
// ────────────────────────────────────────────────────────────────────

model Contract {
  id                 String            @id @default(cuid())
  companyId          String
  company            Company           @relation(fields: [companyId], references: [id])
  planType           ContractPlanType
  startDate          DateTime
  endDate            DateTime?
  monthlyValue       Float             // AOA
  depositAmount      Float             @default(0)
  depositStatus      DepositStatus     @default(PENDING)
  depositPaidAt      DateTime?
  depositReturnedAt  DateTime?
  status             ContractStatus    @default(DRAFT)
  autoRenew          Boolean           @default(false)
  renewalNoticeDays  Int               @default(30)
  adjustmentRules    Json?             // { type: "IPC", rate: 0.05, ... }
  notes              String?
  attachments        String[]          // Cloudinary URLs
  signedAt           DateTime?
  terminatedAt       DateTime?
  terminationReason  String?
  createdBy          String            // FK AdminUser.id
  updatedBy          String?
  deletedAt          DateTime?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  rentSchedules      RentSchedule[]
  invoices           Invoice[]

  @@index([companyId])
  @@index([status])
  @@index([endDate])
}

// ────────────────────────────────────────────────────────────────────
// RENT SCHEDULE
// ────────────────────────────────────────────────────────────────────

model RentSchedule {
  id           String              @id @default(cuid())
  contractId   String
  contract     Contract            @relation(fields: [contractId], references: [id])
  companyId    String
  company      Company             @relation(fields: [companyId], references: [id])
  dueDate      DateTime
  amount       Float               // AOA
  status       RentScheduleStatus  @default(PENDING)
  invoiceId    String?             @unique
  invoice      Invoice?            @relation(fields: [invoiceId], references: [id])
  waivedAt     DateTime?
  waivedBy     String?
  waivedReason String?
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  @@index([contractId])
  @@index([companyId])
  @@index([dueDate])
  @@index([status])
}

// ────────────────────────────────────────────────────────────────────
// INVOICE
// ────────────────────────────────────────────────────────────────────

model Invoice {
  id           String         @id @default(cuid())
  number       String         @unique   // FT-CWORK-2026-000001
  type         InvoiceType
  companyId    String?
  company      Company?       @relation(fields: [companyId], references: [id])
  bookingId    String?        // FK RoomBooking.id
  contractId   String?
  contract     Contract?      @relation(fields: [contractId], references: [id])
  status       InvoiceStatus  @default(DRAFT)
  issueDate    DateTime       @default(now())
  dueDate      DateTime
  subtotal     Float          // AOA sem IVA
  taxRate      Float          @default(0.14)   // 14% IVA Angola
  taxAmount    Float          // AOA — IVA
  total        Float          // AOA com IVA
  pdfUrl       String?
  sentAt       DateTime?
  sentTo       String?        // email destinatário
  paidAt       DateTime?
  notes        String?
  voidedAt     DateTime?
  voidedBy     String?
  voidReason   String?
  createdBy    String
  updatedBy    String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  items        InvoiceItem[]
  payments     Payment[]
  rentSchedule RentSchedule?
  ledgerEntries FinancialLedger[]

  @@index([companyId])
  @@index([status])
  @@index([dueDate])
  @@index([type])
  @@index([number])
}

model InvoiceItem {
  id           String   @id @default(cuid())
  invoiceId    String
  invoice      Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  description  String
  quantity     Float    @default(1)
  unitPrice    Float    // AOA
  total        Float    // AOA = quantity * unitPrice
  accountCode  String   // código do plano de contas (ex.: "7111")
  costCenterId String?
  costCenter   CostCenter? @relation(fields: [costCenterId], references: [id])
  createdAt    DateTime @default(now())

  @@index([invoiceId])
}

// ────────────────────────────────────────────────────────────────────
// PAYMENT
// ────────────────────────────────────────────────────────────────────

model Payment {
  id             String        @id @default(cuid())
  invoiceId      String?
  invoice        Invoice?      @relation(fields: [invoiceId], references: [id])
  companyId      String?
  company        Company?      @relation(fields: [companyId], references: [id])
  amount         Float         // AOA
  method         PaymentMethod
  reference      String?       // referência bancária ou n.º operação
  paidAt         DateTime
  confirmedAt    DateTime?
  confirmedBy    String?       // FK AdminUser.id
  status         PaymentStatus @default(PENDING)
  receiptUrl     String?
  receiptNumber  String?       // REC-2026-000001
  notes          String?
  createdBy      String
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  ledgerEntries  FinancialLedger[]

  @@index([invoiceId])
  @@index([companyId])
  @@index([status])
  @@index([paidAt])
}

// ────────────────────────────────────────────────────────────────────
// FINANCIAL LEDGER (IMUTÁVEL — APPEND-ONLY)
// ────────────────────────────────────────────────────────────────────

model FinancialLedger {
  id           String     @id @default(cuid())
  entryDate    DateTime
  description  String
  type         LedgerType
  amount       Float      // AOA — sempre positivo
  accountCode  String     // código do plano de contas
  costCenterId String?
  costCenter   CostCenter? @relation(fields: [costCenterId], references: [id])
  companyId    String?
  company      Company?   @relation(fields: [companyId], references: [id])
  invoiceId    String?
  invoice      Invoice?   @relation(fields: [invoiceId], references: [id])
  paymentId    String?
  payment      Payment?   @relation(fields: [paymentId], references: [id])
  expenseId    String?
  expense      Expense?   @relation(fields: [expenseId], references: [id])
  reference    String     @unique  // identificador único do lançamento
  reverses     String?    // ID do lançamento que este reverte
  createdBy    String     // AdminUser.id ou "SYSTEM"
  createdAt    DateTime   @default(now())

  // SEM updatedAt — imutável por design (ADR-021)

  @@index([accountCode])
  @@index([entryDate])
  @@index([companyId])
  @@index([costCenterId])
  @@index([type])
}

// ────────────────────────────────────────────────────────────────────
// EXPENSE
// ────────────────────────────────────────────────────────────────────

model ExpenseCategory {
  id          String    @id @default(cuid())
  name        String    @unique
  accountCode String    // código do plano de contas (classe 6)
  description String?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())

  expenses    Expense[]
}

model Expense {
  id             String            @id @default(cuid())
  categoryId     String
  category       ExpenseCategory   @relation(fields: [categoryId], references: [id])
  costCenterId   String?
  costCenter     CostCenter?       @relation(fields: [costCenterId], references: [id])
  supplierName   String?
  supplierNif    String?
  description    String
  amount         Float             // AOA
  dueDate        DateTime
  paidAt         DateTime?
  status         ExpenseStatus     @default(PENDING)
  recurrence     ExpenseRecurrence @default(NONE)
  receiptUrl     String?
  approvedBy     String?
  approvedAt     DateTime?
  rejectedBy     String?
  rejectedReason String?
  notes          String?
  deletedAt      DateTime?
  createdBy      String
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  ledgerEntries  FinancialLedger[]

  @@index([categoryId])
  @@index([costCenterId])
  @@index([status])
  @@index([dueDate])
}

// ────────────────────────────────────────────────────────────────────
// COST CENTER
// ────────────────────────────────────────────────────────────────────

model CostCenter {
  id          String    @id @default(cuid())
  code        String    @unique  // ex.: "OPERACIONAL", "RH", "TI"
  name        String
  description String?
  isActive    Boolean   @default(true)
  budget      Float?    // orçamento mensal AOA
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  invoiceItems    InvoiceItem[]
  expenses        Expense[]
  ledgerEntries   FinancialLedger[]
  cashMovements   CashMovement[]
}

// ────────────────────────────────────────────────────────────────────
// CASH MOVEMENT
// ────────────────────────────────────────────────────────────────────

model CashMovement {
  id           String             @id @default(cuid())
  date         DateTime
  type         CashMovementType
  amount       Float              // AOA — sempre positivo
  description  String
  source       CashMovementSource
  sourceId     String?            // ID do Payment, Expense, etc.
  isProjected  Boolean            @default(false)
  bankAccount  String?            // ex.: "BCS-MAIN"
  balance      Float              // saldo acumulado após este movimento
  costCenterId String?
  costCenter   CostCenter?        @relation(fields: [costCenterId], references: [id])
  createdBy    String
  createdAt    DateTime           @default(now())

  @@index([date])
  @@index([type])
  @@index([isProjected])
}

// ────────────────────────────────────────────────────────────────────
// FINANCIAL ALERT
// ────────────────────────────────────────────────────────────────────

model FinancialAlert {
  id           String        @id @default(cuid())
  type         AlertType
  severity     AlertSeverity @default(WARNING)
  status       AlertStatus   @default(ACTIVE)
  title        String
  message      String
  companyId    String?
  company      Company?      @relation(fields: [companyId], references: [id])
  invoiceId    String?
  contractId   String?
  expenseId    String?
  dueDate      DateTime?
  amount       Float?
  acknowledgedAt  DateTime?
  acknowledgedBy  String?
  resolvedAt   DateTime?
  resolvedBy   String?
  snoozedUntil DateTime?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([status])
  @@index([type])
  @@index([severity])
  @@index([companyId])
}

// ────────────────────────────────────────────────────────────────────
// FINANCIAL REPORT SNAPSHOT
// ────────────────────────────────────────────────────────────────────

model FinancialReportSnapshot {
  id           String   @id @default(cuid())
  period       String   // "2026-07" (YYYY-MM)
  type         String   // "MONTHLY" | "QUARTERLY" | "ANNUAL"
  data         Json     // snapshot completo do relatório
  generatedAt  DateTime @default(now())
  generatedBy  String   // "SYSTEM" ou AdminUser.id

  @@unique([period, type])
  @@index([period])
}
```

---

## 3. Relações com Entidades Existentes

```prisma
// Adicionar ao model Company (existente):
contracts        Contract[]
rentSchedules    RentSchedule[]
invoices         Invoice[]          // (já existe parcialmente)
payments         Payment[]
ledgerEntries    FinancialLedger[]
financialAlerts  FinancialAlert[]
```

---

## 4. Índices de Performance Críticos

```sql
-- Queries mais frequentes no dashboard financeiro:
CREATE INDEX idx_invoice_status_duedate    ON "Invoice"(status, "dueDate");
CREATE INDEX idx_payment_status_paidat     ON "Payment"(status, "paidAt");
CREATE INDEX idx_ledger_accountcode_date   ON "FinancialLedger"("accountCode", "entryDate");
CREATE INDEX idx_expense_status_duedate    ON "Expense"(status, "dueDate");
CREATE INDEX idx_cashmovement_date_type    ON "CashMovement"(date, type);
CREATE INDEX idx_alert_status_severity     ON "FinancialAlert"(status, severity);
CREATE INDEX idx_rentschedule_duedate_sta  ON "RentSchedule"("dueDate", status);
```

---

## 5. Constraints de Integridade

```
Invoice.subtotal + Invoice.taxAmount = Invoice.total           (validado em código)
InvoiceItem.quantity * InvoiceItem.unitPrice = InvoiceItem.total
FinancialLedger.type IN (DEBIT, CREDIT)
FinancialLedger.amount > 0                                     (sempre positivo)
Payment.amount > 0
Expense.amount > 0
CashMovement.amount > 0
Contract.endDate > Contract.startDate                          (se definido)
RentSchedule.amount = Contract.monthlyValue                    (no momento da geração)
```

---

*VD Platform — ERP — Modelo de Dados — Sprint ERP-0*
