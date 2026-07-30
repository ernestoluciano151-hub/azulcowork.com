-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractPlanType" AS ENUM ('FLEX', 'HOT_DESK', 'DEDICATED', 'PRIVATE_OFFICE', 'VIRTUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'PAID', 'RETURNED', 'FORFEITED');

-- CreateEnum
CREATE TYPE "RentScheduleStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ErpInvoiceType" AS ENUM ('COWORKING', 'ROOM', 'SERVICE', 'MIXED', 'EXPENSE_REIMBURSEMENT');

-- CreateEnum
CREATE TYPE "ErpInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'PAID', 'OVERDUE', 'PARTIALLY_PAID', 'CANCELLED', 'VOID');

-- CreateEnum
CREATE TYPE "ErpPaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHECK', 'MULTICAIXA', 'TPA', 'CREDITO');

-- CreateEnum
CREATE TYPE "ErpPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ErpExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseRecurrence" AS ENUM ('NONE', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('INFLOW', 'OUTFLOW', 'TRANSFER', 'PROJECTED');

-- CreateEnum
CREATE TYPE "CashMovementSource" AS ENUM ('PAYMENT', 'EXPENSE', 'CONTRACT', 'BOOKING', 'MANUAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PAYMENT_OVERDUE', 'CONTRACT_EXPIRING', 'CONTRACT_EXPIRED', 'BUDGET_EXCEEDED', 'NEGATIVE_BALANCE', 'DEPOSIT_DUE', 'RECONCILIATION_MISMATCH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'SNOOZED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TimelineEventType" ADD VALUE 'CONTRACT_ACTIVATED';
ALTER TYPE "TimelineEventType" ADD VALUE 'CONTRACT_SUSPENDED';
ALTER TYPE "TimelineEventType" ADD VALUE 'CONTRACT_REACTIVATED';
ALTER TYPE "TimelineEventType" ADD VALUE 'CONTRACT_TERMINATED';
ALTER TYPE "TimelineEventType" ADD VALUE 'CONTRACT_EXPIRED';
ALTER TYPE "TimelineEventType" ADD VALUE 'CONTRACT_DEPOSIT_PAID';
ALTER TYPE "TimelineEventType" ADD VALUE 'CONTRACT_DEPOSIT_RETURNED';
ALTER TYPE "TimelineEventType" ADD VALUE 'CONTRACT_VALUE_ADJUSTED';
ALTER TYPE "TimelineEventType" ADD VALUE 'ERP_INVOICE_ISSUED';
ALTER TYPE "TimelineEventType" ADD VALUE 'ERP_INVOICE_SENT';
ALTER TYPE "TimelineEventType" ADD VALUE 'ERP_INVOICE_PAID';
ALTER TYPE "TimelineEventType" ADD VALUE 'ERP_INVOICE_OVERDUE';
ALTER TYPE "TimelineEventType" ADD VALUE 'ERP_INVOICE_VOIDED';
ALTER TYPE "TimelineEventType" ADD VALUE 'ERP_PAYMENT_CONFIRMED';
ALTER TYPE "TimelineEventType" ADD VALUE 'ERP_PAYMENT_REJECTED';
ALTER TYPE "TimelineEventType" ADD VALUE 'ERP_PAYMENT_REFUNDED';
ALTER TYPE "TimelineEventType" ADD VALUE 'ERP_RECEIPT_GENERATED';
ALTER TYPE "TimelineEventType" ADD VALUE 'EXPENSE_APPROVED';
ALTER TYPE "TimelineEventType" ADD VALUE 'EXPENSE_PAID';
ALTER TYPE "TimelineEventType" ADD VALUE 'FINANCIAL_ALERT_CREATED';
ALTER TYPE "TimelineEventType" ADD VALUE 'FINANCIAL_ALERT_RESOLVED';

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyTag" DROP CONSTRAINT "CompanyTag_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyTag" DROP CONSTRAINT "CompanyTag_tagId_fkey";

-- DropForeignKey
ALTER TABLE "CrmActivity" DROP CONSTRAINT "CrmActivity_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CrmAuditLog" DROP CONSTRAINT "CrmAuditLog_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CrmContact" DROP CONSTRAINT "CrmContact_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CrmDeal" DROP CONSTRAINT "CrmDeal_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CrmNote" DROP CONSTRAINT "CrmNote_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CrmTask" DROP CONSTRAINT "CrmTask_companyId_fkey";

-- DropForeignKey
ALTER TABLE "TimelineEntry" DROP CONSTRAINT "TimelineEntry_companyId_fkey";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "billingEmail" TEXT;

-- AlterTable
ALTER TABLE "CrmContact" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CrmDeal" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CrmNote" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CrmTask" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ErpContract" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planType" "ContractPlanType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "monthlyValue" DOUBLE PRECISION NOT NULL,
    "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositStatus" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "depositPaidAt" TIMESTAMP(3),
    "depositReturnedAt" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "renewalNoticeDays" INTEGER NOT NULL DEFAULT 30,
    "adjustmentRules" JSONB,
    "notes" TEXT,
    "attachments" TEXT[],
    "signedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpRentSchedule" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "RentScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceId" TEXT,
    "waivedAt" TIMESTAMP(3),
    "waivedBy" TEXT,
    "waivedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpRentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "ErpInvoiceType" NOT NULL,
    "companyId" TEXT,
    "bookingId" TEXT,
    "contractId" TEXT,
    "status" "ErpInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.14,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "pdfUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentTo" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "accountCode" TEXT NOT NULL,
    "costCenterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErpInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpPayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT,
    "companyId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "ErpPaymentMethod" NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "status" "ErpPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "receiptUrl" TEXT,
    "receiptNumber" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedger" (
    "id" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "accountCode" TEXT NOT NULL,
    "costCenterId" TEXT,
    "companyId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "expenseId" TEXT,
    "reference" TEXT NOT NULL,
    "reverses" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpExpense" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "costCenterId" TEXT,
    "supplierName" TEXT,
    "supplierNif" TEXT,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "ErpExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "recurrence" "ExpenseRecurrence" NOT NULL DEFAULT 'NONE',
    "receiptUrl" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedReason" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,

    CONSTRAINT "ErpExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "budget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "source" "CashMovementSource" NOT NULL,
    "sourceId" TEXT,
    "isProjected" BOOLEAN NOT NULL DEFAULT false,
    "bankAccount" TEXT,
    "balance" DOUBLE PRECISION NOT NULL,
    "costCenterId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAlert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "companyId" TEXT,
    "invoiceId" TEXT,
    "contractId" TEXT,
    "expenseId" TEXT,
    "dueDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialReportSnapshot" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,

    CONSTRAINT "FinancialReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErpContract_companyId_idx" ON "ErpContract"("companyId");

-- CreateIndex
CREATE INDEX "ErpContract_status_idx" ON "ErpContract"("status");

-- CreateIndex
CREATE INDEX "ErpContract_endDate_idx" ON "ErpContract"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "ErpRentSchedule_invoiceId_key" ON "ErpRentSchedule"("invoiceId");

-- CreateIndex
CREATE INDEX "ErpRentSchedule_contractId_idx" ON "ErpRentSchedule"("contractId");

-- CreateIndex
CREATE INDEX "ErpRentSchedule_companyId_idx" ON "ErpRentSchedule"("companyId");

-- CreateIndex
CREATE INDEX "ErpRentSchedule_dueDate_idx" ON "ErpRentSchedule"("dueDate");

-- CreateIndex
CREATE INDEX "ErpRentSchedule_status_idx" ON "ErpRentSchedule"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ErpInvoice_number_key" ON "ErpInvoice"("number");

-- CreateIndex
CREATE INDEX "ErpInvoice_companyId_idx" ON "ErpInvoice"("companyId");

-- CreateIndex
CREATE INDEX "ErpInvoice_status_idx" ON "ErpInvoice"("status");

-- CreateIndex
CREATE INDEX "ErpInvoice_dueDate_idx" ON "ErpInvoice"("dueDate");

-- CreateIndex
CREATE INDEX "ErpInvoice_type_idx" ON "ErpInvoice"("type");

-- CreateIndex
CREATE INDEX "ErpInvoice_number_idx" ON "ErpInvoice"("number");

-- CreateIndex
CREATE INDEX "ErpInvoiceItem_invoiceId_idx" ON "ErpInvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "ErpPayment_invoiceId_idx" ON "ErpPayment"("invoiceId");

-- CreateIndex
CREATE INDEX "ErpPayment_companyId_idx" ON "ErpPayment"("companyId");

-- CreateIndex
CREATE INDEX "ErpPayment_status_idx" ON "ErpPayment"("status");

-- CreateIndex
CREATE INDEX "ErpPayment_paidAt_idx" ON "ErpPayment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedger_reference_key" ON "FinancialLedger"("reference");

-- CreateIndex
CREATE INDEX "FinancialLedger_accountCode_idx" ON "FinancialLedger"("accountCode");

-- CreateIndex
CREATE INDEX "FinancialLedger_entryDate_idx" ON "FinancialLedger"("entryDate");

-- CreateIndex
CREATE INDEX "FinancialLedger_companyId_idx" ON "FinancialLedger"("companyId");

-- CreateIndex
CREATE INDEX "FinancialLedger_costCenterId_idx" ON "FinancialLedger"("costCenterId");

-- CreateIndex
CREATE INDEX "FinancialLedger_type_idx" ON "FinancialLedger"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "ErpExpense_categoryId_idx" ON "ErpExpense"("categoryId");

-- CreateIndex
CREATE INDEX "ErpExpense_costCenterId_idx" ON "ErpExpense"("costCenterId");

-- CreateIndex
CREATE INDEX "ErpExpense_status_idx" ON "ErpExpense"("status");

-- CreateIndex
CREATE INDEX "ErpExpense_dueDate_idx" ON "ErpExpense"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_code_key" ON "CostCenter"("code");

-- CreateIndex
CREATE INDEX "CashMovement_date_idx" ON "CashMovement"("date");

-- CreateIndex
CREATE INDEX "CashMovement_type_idx" ON "CashMovement"("type");

-- CreateIndex
CREATE INDEX "CashMovement_isProjected_idx" ON "CashMovement"("isProjected");

-- CreateIndex
CREATE INDEX "CashMovement_source_idx" ON "CashMovement"("source");

-- CreateIndex
CREATE INDEX "FinancialAlert_status_idx" ON "FinancialAlert"("status");

-- CreateIndex
CREATE INDEX "FinancialAlert_type_idx" ON "FinancialAlert"("type");

-- CreateIndex
CREATE INDEX "FinancialAlert_severity_idx" ON "FinancialAlert"("severity");

-- CreateIndex
CREATE INDEX "FinancialAlert_companyId_idx" ON "FinancialAlert"("companyId");

-- CreateIndex
CREATE INDEX "FinancialReportSnapshot_period_idx" ON "FinancialReportSnapshot"("period");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialReportSnapshot_period_type_key" ON "FinancialReportSnapshot"("period", "type");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmNote" ADD CONSTRAINT "CrmNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyTag" ADD CONSTRAINT "CompanyTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyTag" ADD CONSTRAINT "CompanyTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAuditLog" ADD CONSTRAINT "CrmAuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpContract" ADD CONSTRAINT "ErpContract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpRentSchedule" ADD CONSTRAINT "ErpRentSchedule_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ErpContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpRentSchedule" ADD CONSTRAINT "ErpRentSchedule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpRentSchedule" ADD CONSTRAINT "ErpRentSchedule_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ErpInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpInvoice" ADD CONSTRAINT "ErpInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpInvoice" ADD CONSTRAINT "ErpInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ErpContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpInvoiceItem" ADD CONSTRAINT "ErpInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ErpInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpInvoiceItem" ADD CONSTRAINT "ErpInvoiceItem_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpPayment" ADD CONSTRAINT "ErpPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ErpInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpPayment" ADD CONSTRAINT "ErpPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedger" ADD CONSTRAINT "FinancialLedger_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedger" ADD CONSTRAINT "FinancialLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedger" ADD CONSTRAINT "FinancialLedger_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ErpInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedger" ADD CONSTRAINT "FinancialLedger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ErpPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedger" ADD CONSTRAINT "FinancialLedger_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "ErpExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpExpense" ADD CONSTRAINT "ErpExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpExpense" ADD CONSTRAINT "ErpExpense_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpExpense" ADD CONSTRAINT "ErpExpense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAlert" ADD CONSTRAINT "FinancialAlert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
