ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "doc2Url"         TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "receiptNumber"   TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "operationRef"    TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "previousBalance" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "Payment_receiptNumber_idx" ON "Payment"("receiptNumber");
