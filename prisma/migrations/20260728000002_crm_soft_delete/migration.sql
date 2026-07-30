-- Migration: CRM soft-delete field
-- Data: 2026-07-28
-- Adiciona crmDeletedAt à tabela Company para suportar soft-delete de empresas CRM
-- sem afectar o campo contractStatus usado pelo módulo de coworking.

ALTER TABLE "Company"
  ADD COLUMN "crmDeletedAt" TIMESTAMP(3);

CREATE INDEX "Company_crmDeletedAt_idx" ON "Company"("crmDeletedAt");
