-- Novo plano "Sala Executiva" (299.900 Kz/mês) — substitui a antiga "Sala Dedicada"
-- (PO, 06 Out 2026). Só altera linhas nunca editadas manualmente (updatedBy IS NULL).

INSERT INTO "CoworkingPlanPrice" ("id", "planType", "monthlyPrice", "dailyPrice", "sortOrder", "updatedAt")
VALUES
  (md5(random()::text || clock_timestamp()::text), 'Sala Executiva',  299900, NULL, 3, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Virtual Office',  19900,  NULL, 4, CURRENT_TIMESTAMP)
ON CONFLICT ("planType") DO UPDATE
  SET "monthlyPrice" = EXCLUDED."monthlyPrice",
      "sortOrder"    = EXCLUDED."sortOrder",
      "updatedAt"    = CURRENT_TIMESTAMP
  WHERE "CoworkingPlanPrice"."updatedBy" IS NULL;
