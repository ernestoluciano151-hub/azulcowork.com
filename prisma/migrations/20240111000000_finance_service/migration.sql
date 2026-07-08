-- Add amountPaid, balance, paidPercentage to Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "balance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paidPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Create InvoicePayment
CREATE TABLE IF NOT EXISTS "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT,
    "operationRef" TEXT,
    "receiptUrl" TEXT,
    "paidDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoicePayment_invoiceId_fkey') THEN
    ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Create LiquidationNote
CREATE TABLE IF NOT EXISTS "LiquidationNote" (
    "id" TEXT NOT NULL,
    "noteNumber" TEXT NOT NULL,
    "invoiceId" TEXT,
    "reservationId" TEXT,
    "companyId" TEXT,
    "amountBilled" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT,
    "operationRef" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiquidationNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LiquidationNote_noteNumber_key" ON "LiquidationNote"("noteNumber");
CREATE INDEX IF NOT EXISTS "LiquidationNote_invoiceId_idx" ON "LiquidationNote"("invoiceId");
CREATE INDEX IF NOT EXISTS "LiquidationNote_companyId_idx" ON "LiquidationNote"("companyId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiquidationNote_companyId_fkey') THEN
    ALTER TABLE "LiquidationNote" ADD CONSTRAINT "LiquidationNote_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Create FinancialAudit
CREATE TABLE IF NOT EXISTS "FinancialAudit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "companyId" TEXT,
    "amount" DOUBLE PRECISION,
    "method" TEXT,
    "reference" TEXT,
    "createdBy" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FinancialAudit_entityId_idx" ON "FinancialAudit"("entityId");
CREATE INDEX IF NOT EXISTS "FinancialAudit_companyId_idx" ON "FinancialAudit"("companyId");
CREATE INDEX IF NOT EXISTS "FinancialAudit_createdAt_idx" ON "FinancialAudit"("createdAt");
