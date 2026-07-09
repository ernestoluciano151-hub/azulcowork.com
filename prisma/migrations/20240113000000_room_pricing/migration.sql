CREATE TABLE IF NOT EXISTS "RoomPricing" (
    "id"              TEXT NOT NULL,
    "roomId"          TEXT NOT NULL DEFAULT 'sala-reuniao',
    "label"           TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "price"           DOUBLE PRECISION NOT NULL,
    "currency"        TEXT NOT NULL DEFAULT 'AOA',
    "active"          BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomPricing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RoomPricing_roomId_idx"          ON "RoomPricing"("roomId");
CREATE INDEX IF NOT EXISTS "RoomPricing_durationMinutes_idx" ON "RoomPricing"("durationMinutes");
CREATE INDEX IF NOT EXISTS "RoomPricing_active_idx"          ON "RoomPricing"("active");

INSERT INTO "RoomPricing" ("id","roomId","label","durationMinutes","price","sortOrder","updatedAt")
SELECT gen_random_uuid()::text,'sala-reuniao','1 Hora',60,15000,1,NOW()
WHERE NOT EXISTS (SELECT 1 FROM "RoomPricing" WHERE "roomId"='sala-reuniao' AND "durationMinutes"=60);

INSERT INTO "RoomPricing" ("id","roomId","label","durationMinutes","price","sortOrder","updatedAt")
SELECT gen_random_uuid()::text,'sala-reuniao','2 Horas',120,28000,2,NOW()
WHERE NOT EXISTS (SELECT 1 FROM "RoomPricing" WHERE "roomId"='sala-reuniao' AND "durationMinutes"=120);

INSERT INTO "RoomPricing" ("id","roomId","label","durationMinutes","price","sortOrder","updatedAt")
SELECT gen_random_uuid()::text,'sala-reuniao','3 Horas',180,40000,3,NOW()
WHERE NOT EXISTS (SELECT 1 FROM "RoomPricing" WHERE "roomId"='sala-reuniao' AND "durationMinutes"=180);

INSERT INTO "RoomPricing" ("id","roomId","label","durationMinutes","price","sortOrder","updatedAt")
SELECT gen_random_uuid()::text,'sala-reuniao','Meio Período',240,50000,4,NOW()
WHERE NOT EXISTS (SELECT 1 FROM "RoomPricing" WHERE "roomId"='sala-reuniao' AND "durationMinutes"=240);

INSERT INTO "RoomPricing" ("id","roomId","label","durationMinutes","price","sortOrder","updatedAt")
SELECT gen_random_uuid()::text,'sala-reuniao','Dia Inteiro',480,90000,5,NOW()
WHERE NOT EXISTS (SELECT 1 FROM "RoomPricing" WHERE "roomId"='sala-reuniao' AND "durationMinutes"=480);
