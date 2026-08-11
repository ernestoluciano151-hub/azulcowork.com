/**
 * pdf-workers/entry.tsx
 *
 * Processo Node standalone para geração de PDFs, TOTALMENTE fora do bundler
 * do Next.js (webpack/SWC). Ver CLAUDE.md (correcções 04-05 Ago 2026) para o
 * histórico completo do bug que motivou este isolamento: "Minified React
 * error #31 — Objects are not valid as a React child (found: object with
 * keys {$$typeof, type, key, ref, props})".
 *
 * Este ficheiro NUNCA é importado por nenhuma rota Next.js — é compilado à
 * parte (ver pdf-workers/build.mjs, via esbuild, `npm run build:pdf-worker`)
 * para pdf-workers/dist/entry.cjs, um único ficheiro CommonJS onde:
 *   - o JSX (deste ficheiro E de todos os componentes importados) é
 *     transformado em React.createElement CLÁSSICO — nunca usa
 *     "react/jsx-runtime", eliminando a possibilidade de divergência de
 *     condição de resolução desse módulo dentro do grafo do Next.
 *   - "react", "react-dom", "@react-pdf/renderer" e as suas dependências
 *     ficam como externos — resolvidos por require() nativo do Node.js a
 *     partir de node_modules, exactamente como nos testes manuais que
 *     confirmaram funcionar sempre fora do bundler do Next.
 *
 * Invocado via child_process a partir de src/lib/pdf-worker-client.ts: lê um
 * JSON `{ kind, data }` do stdin, escreve os bytes do PDF no stdout. Em caso
 * de erro, escreve `{ error, stack }` em JSON no stderr e sai com código 1.
 *
 * Reaproveita os MESMOS componentes/tipos usados nas rotas Next.js (nenhuma
 * duplicação de template — SSoT, ver CLAUDE.md regra 8).
 */
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import { ReceiptDocument, type ReceiptData } from "../src/lib/receipt-pdf";
import { InvoiceDocument, type InvoiceData } from "../src/lib/invoice-pdf";
import {
  InvoiceDoc,
  ReceiptDoc,
  type InvoicePdfData,
  type ReceiptPdfData,
} from "../src/lib/erp-pdf-service";
import {
  ProposalPdfDocument,
  ContractPdfDocument,
  type ProposalData,
  type ContractData,
} from "../src/lib/document-pdf-renderer";

type WorkerInput =
  | { kind: "invoice-download"; data: InvoiceData }
  | { kind: "receipt-download"; data: ReceiptData }
  | { kind: "erp-invoice"; data: InvoicePdfData }
  | { kind: "erp-receipt"; data: ReceiptPdfData }
  | { kind: "proposal"; data: ProposalData }
  | { kind: "contract"; data: ContractData };

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function renderForInput(input: WorkerInput): Promise<Buffer> {
  switch (input.kind) {
    case "invoice-download":
      return renderToBuffer(React.createElement(InvoiceDocument, { inv: input.data }));
    case "receipt-download":
      return renderToBuffer(React.createElement(ReceiptDocument, { rec: input.data }));
    case "erp-invoice":
      return renderToBuffer(React.createElement(InvoiceDoc, { data: input.data }));
    case "erp-receipt":
      return renderToBuffer(React.createElement(ReceiptDoc, { data: input.data }));
    case "proposal":
      return renderToBuffer(React.createElement(ProposalPdfDocument, { d: input.data }));
    case "contract":
      return renderToBuffer(React.createElement(ContractPdfDocument, { d: input.data }));
    default: {
      // Exhaustiveness check — se um novo "kind" for adicionado sem cobrir
      // aqui, o TypeScript falha a compilação do worker (build:pdf-worker).
      const _exhaustive: never = input;
      throw new Error(`[pdf-worker] kind desconhecido: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

async function main() {
  const raw = await readStdin();
  const input = JSON.parse(raw) as WorkerInput;
  const buffer = await renderForInput(input);
  process.stdout.write(buffer);
}

main().catch((err) => {
  process.stderr.write(
    JSON.stringify({ error: err?.message ?? String(err), stack: err?.stack ?? null })
  );
  process.exitCode = 1;
});
