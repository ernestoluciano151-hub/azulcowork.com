-- Migration: CRM Volume 01
-- Data: 2026-07-28
-- Descrição: Adiciona enums e tabelas CRM (Company estendida, CrmContact, CrmDeal,
--            CrmActivity, CrmTask, CrmNote, Tag, CompanyTag, TimelineEntry, CrmAuditLog)

-- ── 1. Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "CompanyStatus" AS ENUM (
  'PROSPECT',
  'QUALIFIED',
  'NEGOTIATION',
  'ACTIVE',
  'INACTIVE',
  'CHURNED',
  'MERGED'
);

CREATE TYPE "PipelineStage" AS ENUM (
  'NEW_LEAD',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'WON',
  'LOST'
);

CREATE TYPE "DealStage" AS ENUM (
  'DISCOVERY',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST'
);

CREATE TYPE "ContactRole" AS ENUM (
  'DECISION_MAKER',
  'INFLUENCER',
  'CHAMPION',
  'END_USER',
  'BILLING',
  'TECHNICAL',
  'OTHER'
);

CREATE TYPE "ActivityType" AS ENUM (
  'CALL',
  'EMAIL',
  'MEETING',
  'VISIT',
  'DEMO',
  'WHATSAPP',
  'OTHER'
);

CREATE TYPE "ActivityDirection" AS ENUM (
  'INBOUND',
  'OUTBOUND'
);

CREATE TYPE "TaskPriority" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

CREATE TYPE "TaskStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED'
);

CREATE TYPE "TimelineEventType" AS ENUM (
  'COMPANY_CREATED',
  'COMPANY_UPDATED',
  'COMPANY_STATUS_CHANGED',
  'COMPANY_OWNER_CHANGED',
  'COMPANY_MERGED',
  'LEAD_CAPTURED',
  'STAGE_CHANGED',
  'DEAL_CREATED',
  'DEAL_UPDATED',
  'DEAL_WON',
  'DEAL_LOST',
  'DEAL_STAGE_CHANGED',
  'CALL_MADE',
  'CALL_RECEIVED',
  'EMAIL_SENT',
  'EMAIL_RECEIVED',
  'MEETING_HELD',
  'VISIT_DONE',
  'DEMO_DONE',
  'WHATSAPP_SENT',
  'WHATSAPP_RECEIVED',
  'TASK_CREATED',
  'TASK_COMPLETED',
  'TASK_OVERDUE',
  'NOTE_ADDED',
  'CONTACT_ADDED',
  'CONTACT_UPDATED',
  'INVOICE_ISSUED',
  'INVOICE_PAID',
  'INVOICE_OVERDUE',
  'PAYMENT_RECEIVED',
  'CONTRACT_CREATED',
  'CONTRACT_RENEWED',
  'CONTRACT_CANCELLED',
  'MEMBER_CHECKIN',
  'MEMBER_CHECKOUT',
  'BOOKING_CREATED',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_COMPLETED'
);

-- ── 2. Estender tabela Company com campos CRM ─────────────────────────────────

ALTER TABLE "Company"
  ADD COLUMN "crmStatus"     "CompanyStatus",
  ADD COLUMN "pipelineStage" "PipelineStage",
  ADD COLUMN "assignedToId"  TEXT,
  ADD COLUMN "website"       TEXT,
  ADD COLUMN "sector"        TEXT,
  ADD COLUMN "country"       TEXT DEFAULT 'Angola',
  ADD COLUMN "mergedIntoId"  TEXT;

-- FK: Company.assignedToId → AdminUser.id
ALTER TABLE "Company"
  ADD CONSTRAINT "Company_assignedToId_fkey"
  FOREIGN KEY ("assignedToId")
  REFERENCES "AdminUser"("id")
  ON DELETE SET NULL;

-- Índices CRM na tabela Company
CREATE INDEX "Company_crmStatus_idx"     ON "Company"("crmStatus");
CREATE INDEX "Company_pipelineStage_idx" ON "Company"("pipelineStage");
CREATE INDEX "Company_assignedToId_idx"  ON "Company"("assignedToId");

-- ── 3. CrmContact ─────────────────────────────────────────────────────────────

CREATE TABLE "CrmContact" (
  "id"          TEXT         NOT NULL,
  "companyId"   TEXT         NOT NULL,
  "firstName"   TEXT         NOT NULL,
  "lastName"    TEXT         NOT NULL,
  "email"       TEXT,
  "phone"       TEXT,
  "role"        "ContactRole" NOT NULL DEFAULT 'OTHER',
  "isPrimary"   BOOLEAN      NOT NULL DEFAULT false,
  "linkedInUrl" TEXT,
  "notes"       TEXT,
  "deletedAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CrmContact"
  ADD CONSTRAINT "CrmContact_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE;

CREATE INDEX "CrmContact_companyId_idx"            ON "CrmContact"("companyId");
CREATE INDEX "CrmContact_email_idx"                ON "CrmContact"("email");
CREATE INDEX "CrmContact_companyId_isPrimary_idx"  ON "CrmContact"("companyId", "isPrimary");

-- ── 4. CrmDeal ────────────────────────────────────────────────────────────────

CREATE TABLE "CrmDeal" (
  "id"            TEXT        NOT NULL,
  "companyId"     TEXT        NOT NULL,
  "title"         TEXT        NOT NULL,
  "stage"         "DealStage" NOT NULL DEFAULT 'DISCOVERY',
  "value"         DOUBLE PRECISION,
  "currency"      TEXT        NOT NULL DEFAULT 'AOA',
  "probability"   INTEGER,
  "expectedClose" TIMESTAMP(3),
  "lostReason"    TEXT,
  "assignedToId"  TEXT,
  "approvedBy"    TEXT,
  "discountPct"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "closedAt"      TIMESTAMP(3),
  "deletedAt"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmDeal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CrmDeal"
  ADD CONSTRAINT "CrmDeal_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE;

CREATE INDEX "CrmDeal_companyId_idx"       ON "CrmDeal"("companyId");
CREATE INDEX "CrmDeal_stage_idx"           ON "CrmDeal"("stage");
CREATE INDEX "CrmDeal_assignedToId_idx"    ON "CrmDeal"("assignedToId");
CREATE INDEX "CrmDeal_expectedClose_idx"   ON "CrmDeal"("expectedClose");
CREATE INDEX "CrmDeal_companyId_stage_idx" ON "CrmDeal"("companyId", "stage");

-- ── 5. CrmActivity ────────────────────────────────────────────────────────────

CREATE TABLE "CrmActivity" (
  "id"          TEXT               NOT NULL,
  "companyId"   TEXT               NOT NULL,
  "type"        "ActivityType"     NOT NULL,
  "direction"   "ActivityDirection" NOT NULL DEFAULT 'OUTBOUND',
  "title"       TEXT               NOT NULL,
  "description" TEXT,
  "durationMin" INTEGER,
  "contactId"   TEXT,
  "dealId"      TEXT,
  "createdById" TEXT,
  "occurredAt"  TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CrmActivity"
  ADD CONSTRAINT "CrmActivity_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE;

CREATE INDEX "CrmActivity_companyId_idx"  ON "CrmActivity"("companyId");
CREATE INDEX "CrmActivity_type_idx"       ON "CrmActivity"("type");
CREATE INDEX "CrmActivity_occurredAt_idx" ON "CrmActivity"("occurredAt");
CREATE INDEX "CrmActivity_dealId_idx"     ON "CrmActivity"("dealId");

-- ── 6. CrmTask ────────────────────────────────────────────────────────────────

CREATE TABLE "CrmTask" (
  "id"           TEXT          NOT NULL,
  "companyId"    TEXT          NOT NULL,
  "title"        TEXT          NOT NULL,
  "description"  TEXT,
  "priority"     "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "status"       "TaskStatus"   NOT NULL DEFAULT 'PENDING',
  "dueDate"      TIMESTAMP(3),
  "completedAt"  TIMESTAMP(3),
  "assignedToId" TEXT,
  "dealId"       TEXT,
  "contactId"    TEXT,
  "createdById"  TEXT,
  "deletedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CrmTask"
  ADD CONSTRAINT "CrmTask_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE;

CREATE INDEX "CrmTask_companyId_idx"        ON "CrmTask"("companyId");
CREATE INDEX "CrmTask_status_idx"           ON "CrmTask"("status");
CREATE INDEX "CrmTask_assignedToId_idx"     ON "CrmTask"("assignedToId");
CREATE INDEX "CrmTask_dueDate_idx"          ON "CrmTask"("dueDate");
CREATE INDEX "CrmTask_companyId_status_idx" ON "CrmTask"("companyId", "status");

-- ── 7. CrmNote ────────────────────────────────────────────────────────────────

CREATE TABLE "CrmNote" (
  "id"        TEXT         NOT NULL,
  "companyId" TEXT         NOT NULL,
  "content"   TEXT         NOT NULL,
  "authorId"  TEXT,
  "dealId"    TEXT,
  "contactId" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CrmNote"
  ADD CONSTRAINT "CrmNote_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE;

CREATE INDEX "CrmNote_companyId_idx" ON "CrmNote"("companyId");
CREATE INDEX "CrmNote_authorId_idx"  ON "CrmNote"("authorId");

-- ── 8. Tag ────────────────────────────────────────────────────────────────────

CREATE TABLE "Tag" (
  "id"        TEXT         NOT NULL,
  "name"      TEXT         NOT NULL,
  "color"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- ── 9. CompanyTag ─────────────────────────────────────────────────────────────

CREATE TABLE "CompanyTag" (
  "companyId"  TEXT         NOT NULL,
  "tagId"      TEXT         NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedBy" TEXT,

  CONSTRAINT "CompanyTag_pkey" PRIMARY KEY ("companyId", "tagId")
);

ALTER TABLE "CompanyTag"
  ADD CONSTRAINT "CompanyTag_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE;

ALTER TABLE "CompanyTag"
  ADD CONSTRAINT "CompanyTag_tagId_fkey"
  FOREIGN KEY ("tagId")
  REFERENCES "Tag"("id")
  ON DELETE CASCADE;

CREATE INDEX "CompanyTag_tagId_idx" ON "CompanyTag"("tagId");

-- ── 10. TimelineEntry (append-only — sem UPDATE/DELETE) ──────────────────────

CREATE TABLE "TimelineEntry" (
  "id"               TEXT                NOT NULL,
  "companyId"        TEXT                NOT NULL,
  "eventType"        "TimelineEventType" NOT NULL,
  "title"            TEXT                NOT NULL,
  "description"      TEXT,
  "metadata"         JSONB               NOT NULL DEFAULT '{}',
  "actorId"          TEXT,
  "actorName"        TEXT,
  "isSystem"         BOOLEAN             NOT NULL DEFAULT false,
  "linkedEntityType" TEXT,
  "linkedEntityId"   TEXT,
  "occurredAt"       TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TimelineEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TimelineEntry"
  ADD CONSTRAINT "TimelineEntry_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE;

CREATE INDEX "TimelineEntry_companyId_occurredAt_idx" ON "TimelineEntry"("companyId", "occurredAt" DESC);
CREATE INDEX "TimelineEntry_eventType_idx"            ON "TimelineEntry"("eventType");
CREATE INDEX "TimelineEntry_occurredAt_idx"           ON "TimelineEntry"("occurredAt");

-- ── 11. CrmAuditLog (append-only — sem UPDATE/DELETE) ────────────────────────

CREATE TABLE "CrmAuditLog" (
  "id"         TEXT         NOT NULL,
  "companyId"  TEXT,
  "action"     TEXT         NOT NULL,
  "entityType" TEXT         NOT NULL,
  "entityId"   TEXT         NOT NULL,
  "actorId"    TEXT,
  "before"     JSONB,
  "after"      JSONB,
  "ip"         TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CrmAuditLog"
  ADD CONSTRAINT "CrmAuditLog_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE SET NULL;

CREATE INDEX "CrmAuditLog_companyId_idx" ON "CrmAuditLog"("companyId");
CREATE INDEX "CrmAuditLog_entityId_idx"  ON "CrmAuditLog"("entityId");
CREATE INDEX "CrmAuditLog_createdAt_idx" ON "CrmAuditLog"("createdAt");
CREATE INDEX "CrmAuditLog_actorId_idx"   ON "CrmAuditLog"("actorId");
