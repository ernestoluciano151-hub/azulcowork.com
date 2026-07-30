/**
 * document-numbering.test.ts — Testes unitários de src/lib/document-numbering.ts
 *
 * Testa nextDocumentNumber com mock de DbClient (sem BD real).
 * Verifica: formato de saída, sequência atómica, tipos suportados.
 */

import { describe, it, expect, vi } from "vitest";
import { nextDocumentNumber } from "@/lib/document-numbering";
import { createPrismaMock } from "@/__tests__/helpers/prisma-mock";

// ─────────────────────────────────────────────
// nextDocumentNumber
// ─────────────────────────────────────────────
describe("nextDocumentNumber", () => {
  it("gera FT-SALA com formato correcto (FT-SALA-YYYY-NNNNNN)", async () => {
    const db = createPrismaMock();
    (db.documentCounter.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ lastSeq: 1 });

    const result = await nextDocumentNumber(db, "FT-SALA", 2026);
    expect(result).toBe("FT-SALA-2026-000001");
  });

  it("gera FT-CWORK com formato correcto", async () => {
    const db = createPrismaMock();
    (db.documentCounter.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ lastSeq: 5 });

    const result = await nextDocumentNumber(db, "FT-CWORK", 2026);
    expect(result).toBe("FT-CWORK-2026-000005");
  });

  it("gera REC com padding a 6 dígitos", async () => {
    const db = createPrismaMock();
    (db.documentCounter.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ lastSeq: 42 });

    const result = await nextDocumentNumber(db, "REC", 2026);
    expect(result).toBe("REC-2026-000042");
  });

  it("gera NL correctamente", async () => {
    const db = createPrismaMock();
    (db.documentCounter.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ lastSeq: 1 });

    const result = await nextDocumentNumber(db, "NL", 2026);
    expect(result).toBe("NL-2026-000001");
  });

  it("gera RES correctamente", async () => {
    const db = createPrismaMock();
    (db.documentCounter.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ lastSeq: 100 });

    const result = await nextDocumentNumber(db, "RES", 2026);
    expect(result).toBe("RES-2026-000100");
  });

  it("usa o ano actual por defeito quando não fornecido", async () => {
    const db = createPrismaMock();
    (db.documentCounter.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ lastSeq: 1 });

    const currentYear = new Date().getFullYear();
    const result = await nextDocumentNumber(db, "REC");
    expect(result).toContain(`REC-${currentYear}-`);
  });

  it("chama upsert com os parâmetros correctos (where + update + create)", async () => {
    const db = createPrismaMock();
    const upsertMock = db.documentCounter.upsert as ReturnType<typeof vi.fn>;
    upsertMock.mockResolvedValue({ lastSeq: 7 });

    await nextDocumentNumber(db, "FT-SALA", 2026);

    expect(upsertMock).toHaveBeenCalledWith({
      where:  { type_year: { type: "FT-SALA", year: 2026 } },
      update: { lastSeq: { increment: 1 } },
      create: { type: "FT-SALA", year: 2026, lastSeq: 1 },
    });
  });

  it("sequence máxima (999999) formata correctamente", async () => {
    const db = createPrismaMock();
    (db.documentCounter.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ lastSeq: 999999 });

    const result = await nextDocumentNumber(db, "REC", 2026);
    expect(result).toBe("REC-2026-999999");
  });

  it("cada chamada usa o lastSeq devolvido pelo upsert", async () => {
    const db = createPrismaMock();
    const upsertMock = db.documentCounter.upsert as ReturnType<typeof vi.fn>;

    // Simular 3 chamadas consecutivas
    upsertMock
      .mockResolvedValueOnce({ lastSeq: 1 })
      .mockResolvedValueOnce({ lastSeq: 2 })
      .mockResolvedValueOnce({ lastSeq: 3 });

    const r1 = await nextDocumentNumber(db, "REC", 2026);
    const r2 = await nextDocumentNumber(db, "REC", 2026);
    const r3 = await nextDocumentNumber(db, "REC", 2026);

    expect(r1).toBe("REC-2026-000001");
    expect(r2).toBe("REC-2026-000002");
    expect(r3).toBe("REC-2026-000003");
  });
});
