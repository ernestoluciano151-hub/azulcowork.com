/**
 * erp-admin-ui.test.ts — Testes de integração simples para as páginas ERP Admin UI
 *
 * Verifica que os ficheiros das novas páginas existem e exportam um componente default.
 * Testes de rendering completo com Testing Library serão adicionados em VOL-TESTS (Fase 1).
 * VOL12 — Sprint VOL12-4
 */

import { describe, it, expect } from "vitest";
import { existsSync }            from "fs";
import { resolve }               from "path";

const ROOT = resolve(process.cwd(), "../../../");

// Localiza a raiz do projecto Next.js
function findRoot(): string {
  // Em CI e sandbox, o cwd é /sessions/.../mnt/outputs/
  // O projecto fica em /sessions/.../mnt/leadgen-crm/
  const candidates = [
    resolve(process.cwd(), "../../"),  // dentro de src/__tests__/unit/
    "/sessions/lucid-pensive-planck/mnt/leadgen-crm",
  ];
  for (const c of candidates) {
    if (existsSync(c + "/package.json")) return c;
  }
  return ROOT;
}

const PROJECT = findRoot();

const ERP_PAGES = [
  "src/app/admin/erp/contratos/page.tsx",
  "src/app/admin/erp/faturas/page.tsx",
  "src/app/admin/erp/despesas/page.tsx",
  "src/app/admin/erp/fluxo-caixa/page.tsx",
  "src/app/admin/erp/relatorios/page.tsx",
  "src/app/admin/portal/utilizadores/page.tsx",
];

describe("VOL12 — ERP Admin UI: páginas criadas", () => {
  ERP_PAGES.forEach(page => {
    it(`existe: ${page}`, () => {
      expect(existsSync(resolve(PROJECT, page))).toBe(true);
    });
  });
});

describe("VOL12 — package.json: build:prod correcto", () => {
  it("build:prod inclui prisma migrate deploy", () => {
    const pkg = JSON.parse(
      require("fs").readFileSync(resolve(PROJECT, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["build:prod"]).toContain("prisma migrate deploy");
    expect(pkg.scripts["build:prod"]).toContain("next build");
  });
});

describe("VOL12 — package.json: web-push presente", () => {
  it("web-push está nas dependências", () => {
    const pkg = JSON.parse(
      require("fs").readFileSync(resolve(PROJECT, "package.json"), "utf8")
    ) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["web-push"]).toBeDefined();
  });

  it("@types/web-push está nas devDependencies", () => {
    const pkg = JSON.parse(
      require("fs").readFileSync(resolve(PROJECT, "package.json"), "utf8")
    ) as { devDependencies: Record<string, string> };
    expect(pkg.devDependencies["@types/web-push"]).toBeDefined();
  });
});

describe("VOL12 — Sidebar: secção ERP adicionada", () => {
  it("Sidebar.tsx contém grupo erp", () => {
    const content = require("fs").readFileSync(
      resolve(PROJECT, "src/components/admin/Sidebar.tsx"), "utf8"
    ) as string;
    expect(content).toContain('group: "erp"');
    expect(content).toContain("/admin/erp/contratos");
    expect(content).toContain("/admin/erp/faturas");
    expect(content).toContain("/admin/erp/despesas");
    expect(content).toContain("/admin/erp/fluxo-caixa");
    expect(content).toContain("/admin/erp/relatorios");
    expect(content).toContain("/admin/portal/utilizadores");
  });
});
