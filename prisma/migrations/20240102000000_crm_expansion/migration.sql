-- Add new columns to Lead table
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "appointmentTime" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "appointmentType" TEXT DEFAULT 'Pedido de contacto';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "company" TEXT;

-- Create Company table
CREATE TABLE IF NOT EXISTS "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nif" TEXT,
    "responsible" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "numEmployees" INTEGER NOT NULL DEFAULT 1,
    "planType" TEXT NOT NULL,
    "contractStart" TIMESTAMP(3) NOT NULL,
    "contractEnd" TIMESTAMP(3) NOT NULL,
    "rentAmount" DOUBLE PRECISION NOT NULL,
    "contractStatus" TEXT NOT NULL DEFAULT 'ATIVO',
    "paymentStatus" TEXT NOT NULL DEFAULT 'EM_DIA',
    "contractFileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Company_contractStatus_idx" ON "Company"("contractStatus");
CREATE INDEX IF NOT EXISTS "Company_contractEnd_idx" ON "Company"("contractEnd");

-- Create Payment table
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Payment_companyId_idx" ON "Payment"("companyId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_dueDate_idx" ON "Payment"("dueDate");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create MeetingRoom table
CREATE TABLE IF NOT EXISTS "MeetingRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISPONIVEL',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingRoom_pkey" PRIMARY KEY ("id")
);

-- Create Reservation table
CREATE TABLE IF NOT EXISTS "Reservation" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "companyId" TEXT,
    "eventName" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "startDatetime" TIMESTAMP(3) NOT NULL,
    "endDatetime" TIMESTAMP(3) NOT NULL,
    "participants" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Reservation_roomId_idx" ON "Reservation"("roomId");
CREATE INDEX IF NOT EXISTS "Reservation_startDatetime_idx" ON "Reservation"("startDatetime");
CREATE INDEX IF NOT EXISTS "Reservation_status_idx" ON "Reservation"("status");

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "MeetingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
