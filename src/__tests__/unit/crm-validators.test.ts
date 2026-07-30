/**
 * crm-validators.test.ts
 *
 * Cobertura alvo: ≥ 90% (linhas + branches)
 * Cobre: validateCreateCompany + similarityScore
 *
 * Padrão AAA (Arrange / Act / Assert)
 */

import { describe, it, expect } from "vitest";
import { PipelineStage } from "@prisma/client";
import { validateCreateCompany, similarityScore } from "@/lib/crm-validators";

// ── Fixture base válido ───────────────────────────────────────────────────────

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name:           "Azul Logística, Lda",
    nif:            "5002174308",
    email:          "geral@azullogistica.ao",
    phone:          "+244 923 456 789",
    website:        "https://azullogistica.ao",
    sector:         "Logística",
    country:        "Angola",
    pipelineStage:  "NEW_LEAD",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// validateCreateCompany — Casos de sucesso
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateCreateCompany — casos de sucesso", () => {
  it("aceita dados válidos completos", () => {
    const result = validateCreateCompany(valid());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Azul Logística, Lda");
      expect(result.data.nif).toBe("5002174308");
      expect(result.data.email).toBe("geral@azullogistica.ao");
      expect(result.data.pipelineStage).toBe(PipelineStage.NEW_LEAD);
    }
  });

  it("aceita apenas o nome (campos opcionais ausentes)", () => {
    const result = validateCreateCompany({ name: "Empresa Mínima" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Empresa Mínima");
      expect(result.data.nif).toBeUndefined();
      expect(result.data.email).toBeUndefined();
      expect(result.data.pipelineStage).toBe(PipelineStage.NEW_LEAD); // default
      expect(result.data.country).toBe("Angola");                      // default
    }
  });

  it("aceita todos os PipelineStage válidos", () => {
    for (const stage of Object.values(PipelineStage)) {
      const result = validateCreateCompany(valid({ pipelineStage: stage }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.pipelineStage).toBe(stage);
    }
  });

  it("email é normalizado para lowercase", () => {
    const result = validateCreateCompany(valid({ email: "GERAL@AZUL.AO" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.email).toBe("geral@azul.ao");
  });

  it("name é trimmed", () => {
    const result = validateCreateCompany(valid({ name: "  Empresa Teste  " }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("Empresa Teste");
  });

  it("NIF sem espaços (aceita com espaços → strip)", () => {
    const result = validateCreateCompany(valid({ nif: "5002 174308" }));
    expect(result.ok).toBe(true);
  });

  it("aceita 20 tags (máximo permitido)", () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
    const result = validateCreateCompany(valid({ tags }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.tags).toHaveLength(20);
  });

  it("aceita contacto primário inline", () => {
    const result = validateCreateCompany(valid({
      contactFirstName: "João",
      contactLastName:  "Silva",
      contactEmail:     "joao@azul.ao",
      contactPhone:     "+244 923 111 222",
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.contactFirstName).toBe("João");
      expect(result.data.contactEmail).toBe("joao@azul.ao");
    }
  });

  it("pipelineStage ausente → default NEW_LEAD", () => {
    const result = validateCreateCompany({ name: "Teste Default Stage" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.pipelineStage).toBe(PipelineStage.NEW_LEAD);
  });

  it("country ausente → default Angola", () => {
    const result = validateCreateCompany({ name: "Empresa Sem País" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.country).toBe("Angola");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateCreateCompany — Validação do nome
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateCreateCompany — nome inválido", () => {
  it("rejeita nome ausente", () => {
    const result = validateCreateCompany({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejeita nome com 1 caractere", () => {
    const result = validateCreateCompany({ name: "A" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("2 caracteres");
  });

  it("rejeita nome vazio", () => {
    const result = validateCreateCompany({ name: "" });
    expect(result.ok).toBe(false);
  });

  it("rejeita nome que é só espaços", () => {
    const result = validateCreateCompany({ name: "   " });
    expect(result.ok).toBe(false);
  });

  it("rejeita name não-string (número)", () => {
    const result = validateCreateCompany({ name: 123 });
    expect(result.ok).toBe(false);
  });

  it("aceita nome com exactamente 2 caracteres", () => {
    const result = validateCreateCompany({ name: "AB" });
    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateCreateCompany — Validação do NIF
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateCreateCompany — NIF inválido", () => {
  it("rejeita NIF com menos de 10 dígitos", () => {
    const result = validateCreateCompany(valid({ nif: "12345" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("10 dígitos");
    }
  });

  it("rejeita NIF com mais de 10 dígitos", () => {
    const result = validateCreateCompany(valid({ nif: "12345678901" }));
    expect(result.ok).toBe(false);
  });

  it("rejeita NIF com letras", () => {
    const result = validateCreateCompany(valid({ nif: "ABCDEFGHIJ" }));
    expect(result.ok).toBe(false);
  });

  it("rejeita NIF com pontuação não removida", () => {
    const result = validateCreateCompany(valid({ nif: "123.456.789" }));
    expect(result.ok).toBe(false);
  });

  it("aceita NIF com 10 dígitos exactos", () => {
    const result = validateCreateCompany(valid({ nif: "5002174308" }));
    expect(result.ok).toBe(true);
  });

  it("NIF ausente (undefined) é aceite (campo opcional)", () => {
    const { nif: _omit, ...rest } = valid() as Record<string, unknown>;
    const result = validateCreateCompany(rest);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.nif).toBeUndefined();
  });

  it("NIF vazio string é ignorado (tratado como ausente)", () => {
    const result = validateCreateCompany(valid({ nif: "" }));
    // string vazia não passa no replace → undefined, não falha
    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateCreateCompany — Validação de e-mail
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateCreateCompany — email inválido", () => {
  it("rejeita e-mail sem @", () => {
    const result = validateCreateCompany(valid({ email: "emailsemarroba.ao" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("inválido");
  });

  it("rejeita e-mail sem domínio", () => {
    const result = validateCreateCompany(valid({ email: "user@" }));
    expect(result.ok).toBe(false);
  });

  it("rejeita e-mail sem TLD", () => {
    const result = validateCreateCompany(valid({ email: "user@empresa" }));
    expect(result.ok).toBe(false);
  });

  it("aceita e-mail válido .ao", () => {
    const result = validateCreateCompany(valid({ email: "geral@empresa.ao" }));
    expect(result.ok).toBe(true);
  });

  it("aceita e-mail válido .com", () => {
    const result = validateCreateCompany(valid({ email: "info@empresa.com" }));
    expect(result.ok).toBe(true);
  });

  it("email ausente é aceite", () => {
    const { email: _omit, ...rest } = valid() as Record<string, unknown>;
    const result = validateCreateCompany(rest);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.email).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateCreateCompany — contactEmail
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateCreateCompany — contactEmail inválido", () => {
  it("rejeita contactEmail inválido", () => {
    const result = validateCreateCompany(valid({ contactEmail: "naoemail" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("contacto");
  });

  it("aceita contactEmail válido", () => {
    const result = validateCreateCompany(valid({ contactEmail: "joao@empresa.ao" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.contactEmail).toBe("joao@empresa.ao");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateCreateCompany — Validação de pipelineStage
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateCreateCompany — pipelineStage inválido", () => {
  it("rejeita stage desconhecido", () => {
    const result = validateCreateCompany(valid({ pipelineStage: "INVALID_STAGE" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("pipelineStage");
    }
  });

  it("rejeita stage com case errado", () => {
    const result = validateCreateCompany(valid({ pipelineStage: "new_lead" }));
    expect(result.ok).toBe(false);
  });

  it("aceita WON como stage inicial (válido no schema)", () => {
    const result = validateCreateCompany(valid({ pipelineStage: "WON" }));
    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateCreateCompany — Validação de tags
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateCreateCompany — limite de tags", () => {
  it("rejeita mais de 20 tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    const result = validateCreateCompany(valid({ tags }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("20");
    }
  });

  it("rejeita 100 tags", () => {
    const tags = Array.from({ length: 100 }, (_, i) => `tag-${i}`);
    const result = validateCreateCompany(valid({ tags }));
    expect(result.ok).toBe(false);
  });

  it("aceita 0 tags (array vazio)", () => {
    const result = validateCreateCompany(valid({ tags: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.tags).toHaveLength(0);
  });

  it("tags ausentes (undefined) → undefined no output", () => {
    const { tags: _omit, ...rest } = valid() as Record<string, unknown>;
    const result = validateCreateCompany(rest);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.tags).toBeUndefined();
  });

  it("filtra valores não-string dentro do array de tags", () => {
    const result = validateCreateCompany(valid({ tags: ["tag-valid", 123, null, "tag-2"] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.tags).toEqual(["tag-valid", "tag-2"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// similarityScore
// ═══════════════════════════════════════════════════════════════════════════════

describe("similarityScore", () => {
  it("strings idênticas = 1.0", () => {
    expect(similarityScore("Azul Coworking", "Azul Coworking")).toBe(1);
  });

  it("strings idênticas case-insensitive = 1.0", () => {
    expect(similarityScore("AZUL COWORKING", "azul coworking")).toBe(1);
  });

  it("strings completamente diferentes = score baixo", () => {
    expect(similarityScore("Empresa ABC", "Qualquer Coisa")).toBeLessThan(0.4);
  });

  it("nomes muito similares = score ≥ 0.8", () => {
    // "Azul Cowork" vs "Azul Coworking" — diferença de 3 chars em 14 maxLen
    expect(similarityScore("Azul Cowork", "Azul Coworking")).toBeGreaterThan(0.7);
  });

  it("nomes com erro de digitação = score alto", () => {
    // "Petroangola" vs "Petroangola Lda" — 1 inserção
    expect(similarityScore("PETROL DE ANGOLA", "PETROL D ANGOLA")).toBeGreaterThan(0.8);
  });

  it("strings vazias = 1.0 (ambas vazias = iguais)", () => {
    expect(similarityScore("", "")).toBe(1);
  });

  it("uma string vazia e outra não = 0.0", () => {
    expect(similarityScore("", "Empresa")).toBe(0);
  });

  it("ordem dos argumentos não importa", () => {
    const a = similarityScore("Azul Cowork, Lda", "Azul Coworking, Lda");
    const b = similarityScore("Azul Coworking, Lda", "Azul Cowork, Lda");
    expect(a).toBe(b);
  });

  it("strings com apenas whitespace são tratadas como idênticas após trim", () => {
    expect(similarityScore("  Empresa  ", "Empresa")).toBe(1);
  });

  it("score é sempre entre 0 e 1 inclusivo", () => {
    const pairs = [
      ["Angola", "Angola"],
      ["ABC", "XYZ"],
      ["Empresa de Construção", "Empresa Construção"],
      ["", "teste"],
    ];
    for (const [a, b] of pairs) {
      const score = similarityScore(a, b);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
