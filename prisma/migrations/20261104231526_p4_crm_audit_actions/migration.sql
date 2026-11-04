-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CRM_RECORD_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CRM_RECORD_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CRM_RECORD_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'CRM_STAGE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'CRM_MERGE';
ALTER TYPE "AuditAction" ADD VALUE 'CRM_TAG_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'CRM_TAG_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'CRM_CONTACT_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'CRM_TASK_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CRM_TASK_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CRM_TASK_COMPLETED';
