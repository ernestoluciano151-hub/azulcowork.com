-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOTP_ENABLED', 'TOTP_DISABLED', 'TOTP_VERIFY_FAILED', 'SESSION_REVOKED', 'ADMIN_USER_CREATED', 'ADMIN_USER_UPDATED', 'ADMIN_USER_DELETED', 'ADMIN_USER_DEACTIVATED', 'ADMIN_USER_REACTIVATED', 'ADMIN_PASSWORD_CHANGED', 'PAYMENT_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_UPDATED', 'PAYMENT_CANCELLED', 'INVOICE_CREATED', 'INVOICE_SENT', 'INVOICE_CANCELLED', 'RESERVATION_CREATED', 'RESERVATION_UPDATED', 'RESERVATION_STATUS_CHANGED', 'RESERVATION_CANCELLED', 'ROOM_SETTINGS_UPDATED', 'PLAN_CREATED', 'PLAN_UPDATED', 'PLAN_DELETED', 'PRICING_UPDATED', 'DOCUMENT_GENERATED', 'DOCUMENT_DOWNLOADED', 'DOCUMENT_SHARED_PORTAL');

-- CreateEnum
CREATE TYPE "CommType" AS ENUM ('EMAIL', 'WHATSAPP', 'WHATSAPP_DEEPLINK');

-- CreateEnum
CREATE TYPE "CommStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "PortalRole" AS ENUM ('PORTAL_OWNER', 'PORTAL_ADMIN', 'PORTAL_MEMBER', 'PORTAL_VIEWER');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "OmnichannelType" AS ENUM ('EMAIL', 'WHATSAPP', 'IN_APP', 'PUSH_WEB');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PortalAlertType" AS ENUM ('RENT_DUE', 'CONTRACT_EXPIRING', 'PAYMENT_OVERDUE', 'BOOKING_CONFIRMED', 'DOCUMENT_AVAILABLE', 'INVOICE_ISSUED', 'PAYMENT_CONFIRMED', 'BOOKING_RECEIVED', 'TICKET_REPLY', 'WELCOME', 'USER_INVITED');

-- CreateEnum
CREATE TYPE "DocumentAccessAction" AS ENUM ('VIEW', 'DOWNLOAD', 'SIGNED_URL_GENERATED', 'VERSION_VIEWED');

-- CreateEnum
CREATE TYPE "SupportMessageSender" AS ENUM ('CLIENT', 'STAFF');

-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('PROPOSAL', 'CONTRACT', 'DECLARATION', 'LETTER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TimelineEventType" ADD VALUE 'PORTAL_USER_INVITED';
ALTER TYPE "TimelineEventType" ADD VALUE 'PORTAL_USER_ACTIVATED';
ALTER TYPE "TimelineEventType" ADD VALUE 'PORTAL_USER_DEACTIVATED';
ALTER TYPE "TimelineEventType" ADD VALUE 'PORTAL_DOCUMENT_UPLOADED';
ALTER TYPE "TimelineEventType" ADD VALUE 'PORTAL_DOCUMENT_DOWNLOADED';
ALTER TYPE "TimelineEventType" ADD VALUE 'PORTAL_DOCUMENT_VIEWED';
ALTER TYPE "TimelineEventType" ADD VALUE 'PORTAL_NOTIFICATION_SENT';
ALTER TYPE "TimelineEventType" ADD VALUE 'PORTAL_TICKET_CREATED';
ALTER TYPE "TimelineEventType" ADD VALUE 'PORTAL_TICKET_REPLIED';
ALTER TYPE "TimelineEventType" ADD VALUE 'PORTAL_TICKET_RESOLVED';
ALTER TYPE "TimelineEventType" ADD VALUE 'PORTAL_TICKET_CLOSED';

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginIp" TEXT;

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityRef" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "type" "CommType" NOT NULL,
    "channel" TEXT NOT NULL,
    "templateSlug" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "CommStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "errorMsg" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "triggeredBy" TEXT NOT NULL DEFAULT 'SYSTEM',
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "variables" TEXT[],
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalUser" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "PortalRole" NOT NULL DEFAULT 'PORTAL_MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "notifyPush" BOOLEAN NOT NULL DEFAULT true,
    "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
    "pushEndpoint" TEXT,
    "pushP256dh" TEXT,
    "pushAuth" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSession" (
    "id" TEXT NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalMagicLink" (
    "id" TEXT NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalMagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "currentVersionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "changeNote" TEXT,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalDocumentAccess" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "versionId" TEXT,
    "action" "DocumentAccessAction" NOT NULL,
    "signedUrl" TEXT,
    "urlExpiresAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalDocumentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalNotification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "portalUserId" TEXT,
    "type" "PortalAlertType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "OmnichannelType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "contractId" TEXT,
    "documentId" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmnichannelMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channel" "OmnichannelType" NOT NULL,
    "recipient" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "template" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "notificationId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmnichannelMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSupportTicket" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "slaDeadline" TIMESTAMP(3),
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalSupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "senderType" "SupportMessageSender" NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalSupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "description" TEXT,
    "htmlBody" TEXT NOT NULL,
    "variables" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "templateSlug" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "cloudinaryId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminUserId_isRevoked_idx" ON "AdminSession"("adminUserId", "isRevoked");

-- CreateIndex
CREATE INDEX "AdminSession_tokenHash_idx" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CommunicationLog_status_idx" ON "CommunicationLog"("status");

-- CreateIndex
CREATE INDEX "CommunicationLog_type_idx" ON "CommunicationLog"("type");

-- CreateIndex
CREATE INDEX "CommunicationLog_entityType_entityId_idx" ON "CommunicationLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CommunicationLog_createdAt_idx" ON "CommunicationLog"("createdAt");

-- CreateIndex
CREATE INDEX "CommunicationLog_to_idx" ON "CommunicationLog"("to");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_slug_key" ON "EmailTemplate"("slug");

-- CreateIndex
CREATE INDEX "PortalUser_companyId_idx" ON "PortalUser"("companyId");

-- CreateIndex
CREATE INDEX "PortalUser_email_idx" ON "PortalUser"("email");

-- CreateIndex
CREATE INDEX "PortalUser_role_idx" ON "PortalUser"("role");

-- CreateIndex
CREATE INDEX "PortalUser_isActive_idx" ON "PortalUser"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PortalUser_companyId_email_key" ON "PortalUser"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSession_tokenHash_key" ON "PortalSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalSession_portalUserId_idx" ON "PortalSession"("portalUserId");

-- CreateIndex
CREATE INDEX "PortalSession_tokenHash_idx" ON "PortalSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalSession_expiresAt_idx" ON "PortalSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalMagicLink_token_key" ON "PortalMagicLink"("token");

-- CreateIndex
CREATE INDEX "PortalMagicLink_token_idx" ON "PortalMagicLink"("token");

-- CreateIndex
CREATE INDEX "PortalMagicLink_portalUserId_idx" ON "PortalMagicLink"("portalUserId");

-- CreateIndex
CREATE INDEX "PortalMagicLink_expiresAt_idx" ON "PortalMagicLink"("expiresAt");

-- CreateIndex
CREATE INDEX "PortalDocument_companyId_idx" ON "PortalDocument"("companyId");

-- CreateIndex
CREATE INDEX "PortalDocument_category_idx" ON "PortalDocument"("category");

-- CreateIndex
CREATE INDEX "PortalDocument_isActive_idx" ON "PortalDocument"("isActive");

-- CreateIndex
CREATE INDEX "PortalDocumentVersion_documentId_idx" ON "PortalDocumentVersion"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalDocumentVersion_documentId_version_key" ON "PortalDocumentVersion"("documentId", "version");

-- CreateIndex
CREATE INDEX "PortalDocumentAccess_documentId_idx" ON "PortalDocumentAccess"("documentId");

-- CreateIndex
CREATE INDEX "PortalDocumentAccess_portalUserId_idx" ON "PortalDocumentAccess"("portalUserId");

-- CreateIndex
CREATE INDEX "PortalDocumentAccess_action_idx" ON "PortalDocumentAccess"("action");

-- CreateIndex
CREATE INDEX "PortalDocumentAccess_createdAt_idx" ON "PortalDocumentAccess"("createdAt");

-- CreateIndex
CREATE INDEX "PortalDocumentAccess_documentId_createdAt_idx" ON "PortalDocumentAccess"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "PortalNotification_companyId_idx" ON "PortalNotification"("companyId");

-- CreateIndex
CREATE INDEX "PortalNotification_portalUserId_idx" ON "PortalNotification"("portalUserId");

-- CreateIndex
CREATE INDEX "PortalNotification_status_idx" ON "PortalNotification"("status");

-- CreateIndex
CREATE INDEX "PortalNotification_channel_idx" ON "PortalNotification"("channel");

-- CreateIndex
CREATE INDEX "PortalNotification_type_idx" ON "PortalNotification"("type");

-- CreateIndex
CREATE INDEX "PortalNotification_nextRetryAt_idx" ON "PortalNotification"("nextRetryAt");

-- CreateIndex
CREATE INDEX "PortalNotification_portalUserId_status_idx" ON "PortalNotification"("portalUserId", "status");

-- CreateIndex
CREATE INDEX "PortalNotification_portalUserId_channel_idx" ON "PortalNotification"("portalUserId", "channel");

-- CreateIndex
CREATE INDEX "PortalNotification_status_nextRetryAt_idx" ON "PortalNotification"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "PortalNotification_companyId_status_nextRetryAt_idx" ON "PortalNotification"("companyId", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "OmnichannelMessage_companyId_idx" ON "OmnichannelMessage"("companyId");

-- CreateIndex
CREATE INDEX "OmnichannelMessage_channel_idx" ON "OmnichannelMessage"("channel");

-- CreateIndex
CREATE INDEX "OmnichannelMessage_status_idx" ON "OmnichannelMessage"("status");

-- CreateIndex
CREATE INDEX "OmnichannelMessage_notificationId_idx" ON "OmnichannelMessage"("notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSupportTicket_number_key" ON "PortalSupportTicket"("number");

-- CreateIndex
CREATE INDEX "PortalSupportTicket_companyId_idx" ON "PortalSupportTicket"("companyId");

-- CreateIndex
CREATE INDEX "PortalSupportTicket_status_idx" ON "PortalSupportTicket"("status");

-- CreateIndex
CREATE INDEX "PortalSupportTicket_priority_idx" ON "PortalSupportTicket"("priority");

-- CreateIndex
CREATE INDEX "PortalSupportTicket_number_idx" ON "PortalSupportTicket"("number");

-- CreateIndex
CREATE INDEX "PortalSupportTicket_createdAt_idx" ON "PortalSupportTicket"("createdAt");

-- CreateIndex
CREATE INDEX "PortalSupportTicket_companyId_status_idx" ON "PortalSupportTicket"("companyId", "status");

-- CreateIndex
CREATE INDEX "PortalSupportTicket_companyId_status_updatedAt_idx" ON "PortalSupportTicket"("companyId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PortalSupportTicket_companyId_createdAt_idx" ON "PortalSupportTicket"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "PortalSupportMessage_ticketId_idx" ON "PortalSupportMessage"("ticketId");

-- CreateIndex
CREATE INDEX "PortalSupportMessage_isInternal_idx" ON "PortalSupportMessage"("isInternal");

-- CreateIndex
CREATE INDEX "PortalSupportMessage_createdAt_idx" ON "PortalSupportMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_slug_key" ON "DocumentTemplate"("slug");

-- CreateIndex
CREATE INDEX "DocumentTemplate_type_isActive_idx" ON "DocumentTemplate"("type", "isActive");

-- CreateIndex
CREATE INDEX "DocumentTemplate_slug_idx" ON "DocumentTemplate"("slug");

-- CreateIndex
CREATE INDEX "GeneratedDocument_entityType_entityId_idx" ON "GeneratedDocument"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_entityType_entityId_templateSlug_idx" ON "GeneratedDocument"("entityType", "entityId", "templateSlug");

-- CreateIndex
CREATE INDEX "GeneratedDocument_templateSlug_idx" ON "GeneratedDocument"("templateSlug");

-- CreateIndex
CREATE INDEX "GeneratedDocument_createdAt_idx" ON "GeneratedDocument"("createdAt");

-- CreateIndex
CREATE INDEX "GeneratedDocument_generatedBy_idx" ON "GeneratedDocument"("generatedBy");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalUser" ADD CONSTRAINT "PortalUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "PortalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMagicLink" ADD CONSTRAINT "PortalMagicLink_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "PortalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDocument" ADD CONSTRAINT "PortalDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDocumentVersion" ADD CONSTRAINT "PortalDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PortalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDocumentAccess" ADD CONSTRAINT "PortalDocumentAccess_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PortalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDocumentAccess" ADD CONSTRAINT "PortalDocumentAccess_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "PortalUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalNotification" ADD CONSTRAINT "PortalNotification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalNotification" ADD CONSTRAINT "PortalNotification_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "PortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSupportTicket" ADD CONSTRAINT "PortalSupportTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSupportTicket" ADD CONSTRAINT "PortalSupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "PortalUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSupportMessage" ADD CONSTRAINT "PortalSupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "PortalSupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateSlug_fkey" FOREIGN KEY ("templateSlug") REFERENCES "DocumentTemplate"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
