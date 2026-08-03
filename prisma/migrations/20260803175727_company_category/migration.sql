-- CompanyCategory: discriminador aditivo, sem impacto em colunas existentes.
-- SALA_PRIVADA = cliente com contrato/espaço dedicado (comportamento actual, default).
-- SALA_REUNIAO = cliente eventual, registado só para reservas de sala de reunião,
--   sem mensalidade real (contractStart/contractEnd recebem placeholder na API).

CREATE TYPE "CompanyCategory" AS ENUM ('SALA_PRIVADA', 'SALA_REUNIAO');

ALTER TABLE "Company"
  ADD COLUMN "category" "CompanyCategory" NOT NULL DEFAULT 'SALA_PRIVADA';
