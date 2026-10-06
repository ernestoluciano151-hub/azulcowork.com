-- CoworkingPlanPrice: tabela aditiva de preços por plano de coworking
-- (Hot Desk, Sala Privada, ...). Fonte única para a renda sugerida ao
-- criar/editar empresas. Não altera nenhuma tabela ou coluna existente.

CREATE TABLE "CoworkingPlanPrice" (
  "id"           TEXT NOT NULL,
  "planType"     TEXT NOT NULL,
  "monthlyPrice" DOUBLE PRECISION NOT NULL,
  "dailyPrice"   DOUBLE PRECISION,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "updatedBy"    TEXT,

  CONSTRAINT "CoworkingPlanPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoworkingPlanPrice_planType_key" ON "CoworkingPlanPrice"("planType");
