-- Actualiza os preços iniciais dos planos (PO, 06 Out 2026):
--   Hot Desk 69.000 Kz; novo plano "Sala Privada Grande" 285.500 Kz;
--   "Sala Dedicada" deixa de ter preço próprio (usa o da Sala Privada).
-- Só toca em linhas nunca editadas manualmente (updatedBy IS NULL); preços
-- que o admin já guardou em Configurações são preservados.

INSERT INTO "CoworkingPlanPrice" ("id", "planType", "monthlyPrice", "dailyPrice", "sortOrder", "updatedAt")
VALUES
  (md5(random()::text || clock_timestamp()::text), 'Hot Desk',            69000,  9900, 0, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Sala Privada',        119900, NULL, 1, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Sala Privada Grande', 285500, NULL, 2, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Virtual Office',      19900,  NULL, 3, CURRENT_TIMESTAMP)
ON CONFLICT ("planType") DO UPDATE
  SET "monthlyPrice" = EXCLUDED."monthlyPrice",
      "sortOrder"    = EXCLUDED."sortOrder",
      "updatedAt"    = CURRENT_TIMESTAMP
  WHERE "CoworkingPlanPrice"."updatedBy" IS NULL;

DELETE FROM "CoworkingPlanPrice" WHERE "planType" = 'Sala Dedicada';
