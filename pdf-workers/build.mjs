/**
 * pdf-workers/build.mjs
 *
 * Compila pdf-workers/entry.tsx (+ os componentes React-PDF que importa de
 * src/lib/) num único ficheiro CommonJS plano: pdf-workers/dist/entry.cjs.
 *
 * Decisões deliberadas (ver CLAUDE.md, correcção 05 Ago 2026):
 *   - jsx: "transform" → JSX vira React.createElement CLÁSSICO. Nunca gera
 *     `require("react/jsx-runtime")`, eliminando a raiz do bug original
 *     (identidade de elemento divergente entre bundles).
 *   - packages: "external" → todos os pacotes de node_modules (react,
 *     react-dom, @react-pdf/renderer, yoga-layout, fontkit, etc.) ficam
 *     como require() nativo em runtime, nunca empacotados por esbuild —
 *     exactamente como nos testes manuais que confirmaram funcionar sempre.
 *
 * Corrido automaticamente antes de "next build" (ver package.json,
 * scripts "build" e "build:prod") — o Vercel executa isto em cada deploy.
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "entry.tsx")],
    outfile: path.join(__dirname, "dist", "entry.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    jsx: "transform",
    packages: "external",
    logLevel: "info",
    legalComments: "none",
  });
  console.log("[pdf-workers] build concluído → pdf-workers/dist/entry.cjs");
}

build().catch((err) => {
  console.error("[pdf-workers] build falhou:", err);
  process.exit(1);
});
