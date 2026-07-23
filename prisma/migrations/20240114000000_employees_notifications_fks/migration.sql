-- Migration: Employee, Notification models + FK relations
-- ──────────────────────────────────────────────────────────

-- 1. Lead: add conversion tracking + company FK
ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "convertedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "convertedBy"   TEXT,
  ADD COLUMN IF NOT EXISTS "leadCompanyId" TEXT;

-- FK: Lead → Company (named relation "LeadSource")
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Lead_leadCompanyId_fkey'
  ) THEN
    ALTER TABLE "Lead"
      ADD CONSTRAINT "Lead_leadCompanyId_fkey"
      FOREIGN KEY ("leadCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Lead_leadCompanyId_idx" ON "Lead"("leadCompanyId");

-- 2. RoomBookingLead: FK → Company
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RoomBookingLead_companyId_fkey'
  ) THEN
    ALTER TABLE "RoomBookingLead"
      ADD CONSTRAINT "RoomBookingLead_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "RoomBookingLead_companyId_idx" ON "RoomBookingLead"("companyId");

-- 3. Timeline: FK → Lead
-- First, NULL out any orphaned leadId values (leadId pointing to deleted Leads)
UPDATE "Timeline"
SET "leadId" = NULL
WHERE "leadId" IS NOT NULL
  AND "leadId" NOT IN (SELECT "id" FROM "Lead");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Timeline_leadId_fkey'
  ) THEN
    ALTER TABLE "Timeline"
      ADD CONSTRAINT "Timeline_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Employee table
CREATE TABLE IF NOT EXISTS "Employee" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "role"        TEXT NOT NULL,
  "department"  TEXT,
  "phone"       TEXT,
  "email"       TEXT,
  "startDate"   TIMESTAMP(3),
  "status"      TEXT NOT NULL DEFAULT 'ATIVO',
  "notes"       TEXT,
  "photoUrl"    TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Employee_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Employee_companyId_idx" ON "Employee"("companyId");
CREATE INDEX IF NOT EXISTS "Employee_status_idx"    ON "Employee"("status");

-- 5. Notification table
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"          TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "message"     TEXT NOT NULL,
  "entityType"  TEXT,
  "entityId"    TEXT,
  "companyId"   TEXT,
  "read"        BOOLEAN NOT NULL DEFAULT false,
  "readAt"      TIMESTAMP(3),
  "priority"    TEXT NOT NULL DEFAULT 'NORMAL',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_read_idx"      ON "Notification"("read");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX IF NOT EXISTS "Notification_companyId_idx" ON "Notification"("companyId");
CREATE INDEX IF NOT EXISTS "Notification_priority_idx"  ON "Notification"("priority");
