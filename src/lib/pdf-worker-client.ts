/**
 * pdf-worker-client.ts — Ponte entre as rotas/serviços Next.js e o processo
 * Node isolado que gera os PDFs (pdf-workers/dist/entry.cjs).
 *
 * 05 Ago 2026 (correcção crítica — piloto, isolamento definitivo): depois de
 * duas tentativas falhadas de ajustar `serverExternalPackages` (ver
 * CLAUDE.md), confirmou-se que o bug "Minified React error #31" é causado
 * por o webpack do Next.js empacotar os NOSSOS componentes React-PDF dentro
 * do grafo de módulos de Route Handlers, onde "react/jsx-runtime" pode
 * resolver sob uma condição diferente da usada pelo require() nativo do
 * "@react-pdf/renderer" externo — produzindo elementos com identidade
 * `$$typeof` que o reconciler recusa. Testes manuais confirmaram que os
 * MESMOS componentes, compilados e corridos fora do bundler do Next
 * (tsc/esbuild + `node` simples), funcionam sempre sem erro.
 *
 * Solução: a geração do PDF deixa de acontecer dentro do processo Next.js.
 * Passa a correr num processo `node` filho, invocando directamente o
 * ficheiro pré-compilado `pdf-workers/dist/entry.cjs` (gerado por
 * `npm run build:pdf-worker`, ver pdf-workers/build.mjs) — um bundle CJS
 * plano onde "react", "react-dom" e "@react-pdf/renderer" são deixados
 * como externos (resolvidos via require() nativo do Node a partir de
 * node_modules) e o JSX é transformado para React.createElement CLÁSSICO
 * (nunca usa "react/jsx-runtime"), eliminando por completo a possibilidade
 * de divergência de identidade entre árvores de elementos.
 *
 * Dados de entrada são enviados via stdin como JSON; o processo filho
 * devolve os bytes do PDF via stdout. Erros são reportados via stderr
 * (JSON) + exit code != 0.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const WORKER_PATH = path.join(process.cwd(), "pdf-workers", "dist", "entry.cjs");

// Tempo máximo de espera pelo worker — a geração de um PDF A4 simples demora
// tipicamente <1s; 20s dá margem generosa para arranque a frio do processo
// Node + carga de fontes, sem deixar um pedido preso indefinidamente.
const WORKER_TIMEOUT_MS = 20_000;

export type PdfWorkerKind =
  | "invoice-download"
  | "receipt-download"
  | "erp-invoice"
  | "erp-receipt"
  | "proposal"
  | "contract";

/**
 * Invoca o worker de PDF num processo Node separado e devolve o Buffer do
 * PDF gerado. `data` tem de ser serializável em JSON (nenhum dos tipos de
 * dados dos documentos actuais usa Buffer/Date nativo directamente — ver
 * inventário em CLAUDE.md, correcção 05 Ago 2026).
 */
export function renderPdfInWorker(kind: PdfWorkerKind, data: unknown): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WORKER_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
      // Isolar de variáveis de ambiente desnecessárias não é preciso aqui —
      // o worker só precisa de Node + node_modules, já herdados do processo pai.
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`[pdf-worker] timeout após ${WORKER_TIMEOUT_MS}ms (kind="${kind}")`));
    }, WORKER_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`[pdf-worker] falha ao iniciar processo: ${err.message}`));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        const stderrText = Buffer.concat(stderrChunks).toString("utf8");
        let detail = stderrText || `processo terminou com código ${code}`;
        try {
          const parsed = JSON.parse(stderrText);
          if (parsed?.error) detail = parsed.error;
        } catch {
          // stderr não era JSON — usar texto em bruto
        }
        reject(new Error(`[pdf-worker] kind="${kind}": ${detail}`));
        return;
      }

      const buffer = Buffer.concat(stdoutChunks);
      if (buffer.length === 0) {
        reject(new Error(`[pdf-worker] kind="${kind}": worker devolveu buffer vazio`));
        return;
      }
      resolve(buffer);
    });

    child.stdin.write(JSON.stringify({ kind, data }));
    child.stdin.end();
  });
}
