-- Migration: AdminRole enum
-- Fix: remover DEFAULT antes de ALTER TYPE (PostgreSQL não faz cast automático do default).

-- Passo 1: Criar o tipo enum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'COMERCIAL', 'FINANCEIRO', 'VIEWER');

-- Passo 2: Normalizar valores inválidos/legados
UPDATE "AdminUser"
SET "role" = 'VIEWER'
WHERE "role" NOT IN ('ADMIN', 'COMERCIAL', 'FINANCEIRO', 'VIEWER');

-- Passo 3: Remover o DEFAULT existente (necessário antes de ALTER TYPE no PostgreSQL)
ALTER TABLE "AdminUser" ALTER COLUMN "role" DROP DEFAULT;

-- Passo 4: Converter a coluna para o tipo enum
ALTER TABLE "AdminUser"
  ALTER COLUMN "role" TYPE "AdminRole"
  USING "role"::"AdminRole";

-- Passo 5: Repor o DEFAULT com o tipo correcto (VIEWER — princípio de menor privilégio)
ALTER TABLE "AdminUser"
  ALTER COLUMN "role" SET DEFAULT 'VIEWER'::"AdminRole";
