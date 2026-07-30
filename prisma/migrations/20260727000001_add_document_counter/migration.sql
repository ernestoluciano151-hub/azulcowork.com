-- Migration: add_document_counter
-- DT-014: Contador atómico de numeração de documentos financeiros.
-- Elimina race condition de `count + 1` com upsert + increment atómico do PostgreSQL.

CREATE TABLE "DocumentCounter" (
    "id"      TEXT NOT NULL,
    "type"    TEXT NOT NULL,
    "year"    INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentCounter_type_year_key" ON "DocumentCounter"("type", "year");
CREATE INDEX "DocumentCounter_type_year_idx" ON "DocumentCounter"("type", "year");
