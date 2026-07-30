/**
 * validators.test.ts — Testes unitários de src/lib/validators.ts
 *
 * Padrão AAA (Arrange / Act / Assert)
 * Cobertura alvo: 100% (funções puras sem dependências)
 */

import { describe, it, expect } from "vitest";
import { isValidEmail, isValidWhatsapp, sanitizeText } from "@/lib/validators";

// ─────────────────────────────────────────────
// isValidEmail
// ─────────────────────────────────────────────
describe("isValidEmail", () => {
  it("aceita email válido simples", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("aceita email com subdomínio", () => {
    expect(isValidEmail("user@mail.azulcowork.com")).toBe(true);
  });

  it("aceita email com domínio .ao", () => {
    expect(isValidEmail("empresa@angola.ao")).toBe(true);
  });

  it("rejeita email sem @", () => {
    expect(isValidEmail("invalido.com")).toBe(false);
  });

  it("rejeita email sem domínio", () => {
    expect(isValidEmail("user@")).toBe(false);
  });

  it("rejeita email sem local part", () => {
    expect(isValidEmail("@domain.com")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejeita email com espaço", () => {
    expect(isValidEmail("user @example.com")).toBe(false);
  });

  it("aceita email com + no local part", () => {
    expect(isValidEmail("user+tag@example.com")).toBe(true);
  });
});

// ─────────────────────────────────────────────
// isValidWhatsapp
// ─────────────────────────────────────────────
describe("isValidWhatsapp", () => {
  it("aceita número angolano de 9 dígitos", () => {
    expect(isValidWhatsapp("923456789")).toBe(true);
  });

  it("aceita número com prefixo internacional +244", () => {
    expect(isValidWhatsapp("+244923456789")).toBe(true);
  });

  it("aceita número com espaços e traços (conta apenas dígitos)", () => {
    expect(isValidWhatsapp("923 456 789")).toBe(true);
  });

  it("aceita número com 15 dígitos (máximo)", () => {
    expect(isValidWhatsapp("244923456789012")).toBe(true);
  });

  it("rejeita número com menos de 9 dígitos", () => {
    expect(isValidWhatsapp("12345678")).toBe(false);
  });

  it("rejeita número com mais de 15 dígitos", () => {
    expect(isValidWhatsapp("1234567890123456")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(isValidWhatsapp("")).toBe(false);
  });

  it("aceita número formatado com parênteses", () => {
    expect(isValidWhatsapp("(923) 456-789")).toBe(true);
  });
});

// ─────────────────────────────────────────────
// sanitizeText
// ─────────────────────────────────────────────
describe("sanitizeText", () => {
  it("remove < de string com tag", () => {
    // sanitizeText remove AMBOS < e > — resultado sem nenhum deles
    expect(sanitizeText("<script>")).toBe("script");
  });

  it("remove > de string com tag de fecho", () => {
    expect(sanitizeText("alert(1)>")).toBe("alert(1)");
  });

  it("remove todos os < e > de XSS payload", () => {
    expect(sanitizeText("<script>alert('xss')</script>")).toBe("scriptalert('xss')/script");
  });

  it("faz trim de espaços", () => {
    expect(sanitizeText("  texto com espaços  ")).toBe("texto com espaços");
  });

  it("não altera texto seguro", () => {
    expect(sanitizeText("Empresa de Tecnologia Lda.")).toBe("Empresa de Tecnologia Lda.");
  });

  it("remove < e > e faz trim em simultâneo", () => {
    expect(sanitizeText("  <b>bold</b>  ")).toBe("bbold/b");
  });

  it("retorna string vazia para input vazio", () => {
    expect(sanitizeText("")).toBe("");
  });

  it("preserva caracteres especiais angolanos (acentos)", () => {
    expect(sanitizeText("Luanda, Bairro Azul — Edifício 18")).toBe("Luanda, Bairro Azul — Edifício 18");
  });
});
