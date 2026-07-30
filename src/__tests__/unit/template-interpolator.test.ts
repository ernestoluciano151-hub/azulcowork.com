/**
 * template-interpolator.test.ts — VOL07-4
 *
 * Testa as funções puras do módulo template-interpolator:
 *   interpolate, extractVariables, missingVariables, interpolateEmailTemplate
 *
 * Critério de DoD: ≥ 10 assertions.
 */

import { describe, it, expect } from "vitest";
import {
  interpolate,
  extractVariables,
  missingVariables,
  interpolateEmailTemplate,
  type TemplateVars,
} from "@/lib/template-interpolator";

// ── interpolate ───────────────────────────────────────────────────────────────

describe("interpolate", () => {
  it("substitui variável simples", () => {
    expect(interpolate("Olá {{nome}}!", { nome: "Ernesto" })).toBe("Olá Ernesto!");
  });

  it("substitui múltiplas variáveis", () => {
    const result = interpolate("{{a}} + {{b}} = {{c}}", { a: 1, b: 2, c: 3 });
    expect(result).toBe("1 + 2 = 3");
  });

  it("substitui variável com espaços nos delimitadores", () => {
    expect(interpolate("Olá {{ nome }}!", { nome: "Ana" })).toBe("Olá Ana!");
  });

  it("retorna string vazia para variável ausente", () => {
    expect(interpolate("Olá {{nome}}!", {})).toBe("Olá !");
  });

  it("retorna string vazia para null", () => {
    const vars: TemplateVars = { nome: null };
    expect(interpolate("{{nome}}", vars)).toBe("");
  });

  it("retorna string vazia para undefined", () => {
    const vars: TemplateVars = { nome: undefined };
    expect(interpolate("{{nome}}", vars)).toBe("");
  });

  it("converte número para string", () => {
    expect(interpolate("Total: {{total}} Kz", { total: 5000 })).toBe("Total: 5000 Kz");
  });

  it("converte boolean para string", () => {
    expect(interpolate("Activo: {{activo}}", { activo: true })).toBe("Activo: true");
  });

  it("não altera texto sem variáveis", () => {
    const t = "Texto simples sem vars.";
    expect(interpolate(t, { foo: "bar" })).toBe(t);
  });

  it("substitui mesma variável múltiplas vezes", () => {
    expect(interpolate("{{x}} {{x}} {{x}}", { x: "A" })).toBe("A A A");
  });

  it("não substitui variável com formato errado (sem espaço interno)", () => {
    // {nome} (apenas um par de chaves) não deve ser substituído
    expect(interpolate("{nome}", { nome: "X" })).toBe("{nome}");
  });
});

// ── extractVariables ──────────────────────────────────────────────────────────

describe("extractVariables", () => {
  it("extrai variáveis únicas em ordem de aparecimento", () => {
    const vars = extractVariables("Olá {{nome}}, o total é {{total}}.");
    expect(vars).toEqual(["nome", "total"]);
  });

  it("não duplica variáveis repetidas", () => {
    const vars = extractVariables("{{x}} e {{x}} de novo");
    expect(vars).toEqual(["x"]);
  });

  it("retorna array vazio para template sem variáveis", () => {
    expect(extractVariables("Texto limpo")).toEqual([]);
  });

  it("suporta delimitadores com espaços", () => {
    const vars = extractVariables("{{ nome }} e {{ email }}");
    expect(vars).toEqual(["nome", "email"]);
  });
});

// ── missingVariables ──────────────────────────────────────────────────────────

describe("missingVariables", () => {
  it("retorna lista de variáveis em falta", () => {
    const missing = missingVariables(["nome", "total", "email"], { nome: "Ernesto" });
    expect(missing).toEqual(["total", "email"]);
  });

  it("retorna array vazio quando todas presentes", () => {
    const missing = missingVariables(["a", "b"], { a: "1", b: "2" });
    expect(missing).toEqual([]);
  });

  it("trata string vazia como ausente", () => {
    const missing = missingVariables(["slug"], { slug: "" });
    expect(missing).toEqual(["slug"]);
  });

  it("trata null como ausente", () => {
    const vars: TemplateVars = { campo: null };
    const missing = missingVariables(["campo"], vars);
    expect(missing).toEqual(["campo"]);
  });
});

// ── interpolateEmailTemplate ──────────────────────────────────────────────────

describe("interpolateEmailTemplate", () => {
  it("interpola subject e htmlBody", () => {
    const tpl = {
      subject: "Factura {{numero}} — Azul Coworking",
      htmlBody: "<p>Estimado {{empresa}}</p>",
    };
    const { subject, html } = interpolateEmailTemplate(tpl, {
      numero:  "FT-CWORK-2026-000001",
      empresa: "ACME Lda",
    });
    expect(subject).toBe("Factura FT-CWORK-2026-000001 — Azul Coworking");
    expect(html).toBe("<p>Estimado ACME Lda</p>");
  });

  it("retorna htmlBody como html na chave correcta", () => {
    const { html } = interpolateEmailTemplate(
      { subject: "s", htmlBody: "<b>{{v}}</b>" },
      { v: "OK" }
    );
    expect(html).toBe("<b>OK</b>");
  });

  it("variável ausente → string vazia no html", () => {
    const { html } = interpolateEmailTemplate(
      { subject: "s", htmlBody: "<p>{{ausente}}</p>" },
      {}
    );
    expect(html).toBe("<p></p>");
  });
});
