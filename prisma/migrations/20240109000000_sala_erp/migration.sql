-- Sala de Reunião ERP Integration
-- Adds pricing to MeetingPlan, full ERP fields to Reservation,
-- makes Payment/Invoice companyId nullable for standalone sala payments

-- ── MeetingPlan: add pricing fields ─────────────────────────────────────────
ALTER TABLE "MeetingPlan" ADD COLUMN IF NOT EXISTS "pricePerHour"     DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MeetingPlan" ADD COLUMN IF NOT EXISTS "coffeeBreakPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ── Reservation: add ERP fields ─────────────────────────────────────────────
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "reservationNumber" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "companyId"         TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "email"             TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "whatsapp"          TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "paymentOption"     TEXT NOT NULL DEFAULT 'PAGAR_NO_DIA';
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "amount"            DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "discount"          DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "iva"               DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "totalAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "paymentStatus"     TEXT NOT NULL DEFAULT 'PENDENTE';
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "paymentMethod"     TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "operationRef"      TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "receiptUrl"        TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "financialNotes"    TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "paymentId"         TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "invoiceId"         TEXT;

-- FK: Reservation → Company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_companyId_fkey'
  ) THEN
    ALTER TABLE "Reservation"
      ADD CONSTRAINT "Reservation_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes on Reservation
CREATE INDEX IF NOT EXISTS "Reservation_companyId_idx"         ON "Reservation"("companyId");
CREATE INDEX IF NOT EXISTS "Reservation_paymentStatus_idx"     ON "Reservation"("paymentStatus");
CREATE INDEX IF NOT EXISTS "Reservation_reservationNumber_idx" ON "Reservation"("reservationNumber");

-- ── Payment: make companyId nullable ─────────────────────────────────────────
ALTER TABLE "Payment" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reservationId" TEXT;
CREATE INDEX IF NOT EXISTS "Payment_reservationId_idx" ON "Payment"("reservationId");

-- ── Invoice: make companyId nullable, add discount/IVA/total + reservationId ─
ALTER TABLE "Invoice" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "reservationId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "discount"      DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "iva"           DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "totalAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Invoice_reservationId_idx" ON "Invoice"("reservationId");
