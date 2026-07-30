/**
 * /admin/documentos — Histórico de documentos gerados
 *
 * Tabela paginada de GeneratedDocument com filtros:
 *  - entityType (LEAD / ERPCONTRACT / COMPANY)
 *  - type (PROPOSAL / CONTRACT / DECLARATION / LETTER)
 * Download via URL assinada (TTL 15 min) → abre nova aba.
 *
 * Permissões: ADMIN, COMERCIAL
 * VOL08 — Sprint VOL08-3A
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface GeneratedDoc {
  id:              string;
  templateSlug:    string;
  type:            string;
  entityType:      string;
  entityId:        string;
  version:         number;
  templateVersion: number;
  fileName:        string;
  fileSizeBytes:   number;
  sha256Hash:      string;
  generatedBy:     string;
  generatedAt:     string;
}

interface Pagination {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
}

const ENTITY_TYPES = ["", "LEAD", "ERPCONTRACT", "COMPANY"] as const;
const DOC_TYPES    = ["", "PROPOSAL", "CONTRACT", "DECLARATION", "LETTER"] as const;

const ENTITY_LABELS: Record<string, string> = {
  LEAD:        "Lead",
  ERPCONTRACT: "Contrato ERP",
  COMPANY:     "Empresa",
};

const TYPE_LABELS: Record<string, string> = {
  PROPOSAL:    "Proposta",
  CONTRACT:    "Contrato",
  DECLARATION: "Declaração",
  LETTER:      "Carta",
};

const TYPE_COLOURS: Record<string, string> = {
  PROPOSAL:    "bg-blue-500/20 text-blue-300",
  CONTRACT:    "bg-emerald-500/20 text-emerald-300",
  DECLARATION: "bg-purple-500/20 text-purple-300",
  LETTER:      "bg-amber-500/20 text-amber-300",
};

function fmtBytes(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-AO", {
    day:    "2-digit",
    month:  "2-digit",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DocumentosPage() {
  const [docs,       setDocs]       = useState<GeneratedDoc[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Filtros
  const [entityType, setEntityType] = useState("");
  const [docType,    setDocType]    = useState("");
  const [page,       setPage]       = useState(1);

  // Download state
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: "20",
        ...(entityType && { entityType }),
        ...(docType    && { type: docType }),
      });
      const r = await fetch(`/api/admin/documents?${params}`);
      if (!r.ok) throw new Error("Erro ao carregar documentos");
      const data = await r.json() as { docs: GeneratedDoc[]; pagination: Pagination };
      setDocs(data.docs);
      setPagination(data.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [page, entityType, docType]);

  useEffect(() => { void fetchDocs(); }, [fetchDocs]);

  // Reset página ao mudar filtros
  useEffect(() => { setPage(1); }, [entityType, docType]);

  async function handleDownload(id: string, fileName: string) {
    setDownloading(id);
    try {
      const r = await fetch(`/api/admin/documents/${id}`);
      if (!r.ok) throw new Error("Erro ao obter URL de download");
      const data = await r.json() as { downloadUrl: string };
      window.open(data.downloadUrl, "_blank");
    } catch {
      alert("Não foi possível obter o link de download.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="min-h-screen bg-ink p-6 text-paper">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Documentos Gerados</h1>
        <p className="mt-1 text-sm text-mist">
          Histórico de todos os documentos gerados pelo sistema. Downloads expiram em 15 minutos.
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper focus:outline-none focus:ring-1 focus:ring-azul"
        >
          <option value="">Todos os tipos de entidade</option>
          {ENTITY_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>{ENTITY_LABELS[t] ?? t}</option>
          ))}
        </select>

        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper focus:outline-none focus:ring-1 focus:ring-azul"
        >
          <option value="">Todos os tipos de documento</option>
          {DOC_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>

        <button
          onClick={fetchDocs}
          className="rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-mist transition hover:bg-white/5 hover:text-paper"
        >
          ↻ Actualizar
        </button>

        {pagination && (
          <span className="ml-auto text-xs text-mist">
            {pagination.total} documento{pagination.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Tabela */}
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-mist">
          <span className="animate-pulse">A carregar documentos…</span>
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-mist">
          <span className="text-4xl">📄</span>
          <p className="text-sm">Nenhum documento gerado ainda.</p>
          <p className="text-xs opacity-60">
            Use o botão "Gerar Proposta" na ficha de um Lead ou o botão "Gerar Contrato" num contrato ERP.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-ink2">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mist">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mist">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mist">Entidade</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mist">Versão</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mist">Tamanho</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mist">Gerado em</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mist">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {docs.map((doc) => (
                <tr key={doc.id} className="transition hover:bg-white/3">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📄</span>
                      <div>
                        <p className="font-medium text-paper">{doc.fileName}</p>
                        <p className="text-xs text-mist font-mono">{doc.templateSlug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOURS[doc.type] ?? "bg-white/10 text-mist"}`}>
                      {TYPE_LABELS[doc.type] ?? doc.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-paper">{ENTITY_LABELS[doc.entityType] ?? doc.entityType}</p>
                      <p className="text-xs font-mono text-mist">{doc.entityId.slice(0, 8)}…</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-mono">
                        v{doc.version}
                      </span>
                      <p className="mt-0.5 text-xs text-mist">tpl v{doc.templateVersion}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-mist">{fmtBytes(doc.fileSizeBytes)}</td>
                  <td className="px-4 py-3 text-mist">{fmtDate(doc.generatedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void handleDownload(doc.id, doc.fileName)}
                      disabled={downloading === doc.id}
                      className="flex items-center gap-1.5 rounded-lg border border-azul/30 bg-azul/10 px-3 py-1.5 text-xs text-azul-glow transition hover:bg-azul/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {downloading === doc.id ? (
                        <span className="animate-pulse">…</span>
                      ) : (
                        <>⬇ Download</>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-mist disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-mist">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-mist disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
