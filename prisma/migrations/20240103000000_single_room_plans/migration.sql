-- Drop old tables
DROP TABLE IF EXISTS "Reservation";
DROP TABLE IF EXISTS "MeetingRoom";

-- Create MeetingPlan
CREATE TABLE "MeetingPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxPeople" INTEGER NOT NULL,
    "description" TEXT,
    "coffeeBreakAvailable" BOOLEAN NOT NULL DEFAULT true,
    "customPricingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "minHoursForCustom" INTEGER DEFAULT 16,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingPlan_pkey" PRIMARY KEY ("id")
);

-- Create new Reservation
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "companyName" TEXT,
    "responsible" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "participants" INTEGER NOT NULL,
    "startDatetime" TIMESTAMP(3) NOT NULL,
    "endDatetime" TIMESTAMP(3) NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "coffeeBreak" BOOLEAN NOT NULL DEFAULT false,
    "observations" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADA',
    "isCustomPricing" BOOLEAN NOT NULL DEFAULT false,
    "customRequest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Reservation_planId_idx" ON "Reservation"("planId");
CREATE INDEX "Reservation_startDatetime_idx" ON "Reservation"("startDatetime");
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- Foreign key
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MeetingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove companyId from Reservation if it exists in Company relation
ALTER TABLE "Company" DROP CONSTRAINT IF EXISTS "Company_reservations_fkey";
