-- Add ERP link fields to RoomBookingLead
ALTER TABLE "RoomBookingLead" ADD COLUMN IF NOT EXISTS "companyId"    TEXT;
ALTER TABLE "RoomBookingLead" ADD COLUMN IF NOT EXISTS "reservationId" TEXT;
ALTER TABLE "RoomBookingLead" ADD COLUMN IF NOT EXISTS "convertedAt"  TIMESTAMPTZ;
ALTER TABLE "RoomBookingLead" ADD COLUMN IF NOT EXISTS "convertedBy"  TEXT;

-- Add lead source to Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "leadSourceId" TEXT;

-- Add lead source to Reservation
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "roomBookingLeadId" TEXT;

-- Timeline (unified CRM history)
CREATE TABLE IF NOT EXISTS "Timeline" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT,
  "leadId"        TEXT,
  "type"          TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "amount"        DOUBLE PRECISION,
  "referenceId"   TEXT,
  "referenceType" TEXT,
  "createdBy"     TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Timeline_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Timeline_companyId_idx" ON "Timeline"("companyId");
CREATE INDEX IF NOT EXISTS "Timeline_leadId_idx"    ON "Timeline"("leadId");
CREATE INDEX IF NOT EXISTS "Timeline_createdAt_idx" ON "Timeline"("createdAt");
