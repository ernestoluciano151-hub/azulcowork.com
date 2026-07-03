-- Add paymentFrequency to Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "paymentFrequency" TEXT NOT NULL DEFAULT 'MENSAL';

-- Create FinancialHistory
CREATE TABLE IF NOT EXISTS "FinancialHistory" (
    "id"             TEXT NOT NULL,
    "companyId"      TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "description"    TEXT NOT NULL,
    "amount"         DOUBLE PRECISION NOT NULL,
    "runningBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "method"         TEXT,
    "reference"      TEXT,
    "createdBy"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FinancialHistory"
    ADD CONSTRAINT "FinancialHistory_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "FinancialHistory_companyId_idx" ON "FinancialHistory"("companyId");
CREATE INDEX IF NOT EXISTS "FinancialHistory_createdAt_idx"  ON "FinancialHistory"("createdAt");
