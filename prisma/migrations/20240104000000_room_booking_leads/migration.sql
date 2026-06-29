ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "spaceType" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "planName" TEXT;

CREATE TABLE IF NOT EXISTS "RoomBookingLead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "participants" INTEGER,
    "preferredDate" TIMESTAMP(3),
    "preferredTime" TEXT,
    "observations" TEXT,
    "coffeeBreak" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NOVO',
    "source" TEXT NOT NULL DEFAULT 'landing-sala',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomBookingLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RoomBookingLead_status_idx" ON "RoomBookingLead"("status");
CREATE INDEX IF NOT EXISTS "RoomBookingLead_createdAt_idx" ON "RoomBookingLead"("createdAt");
CREATE INDEX IF NOT EXISTS "RoomBookingLead_planName_idx" ON "RoomBookingLead"("planName");
