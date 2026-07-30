"use client";

/**
 * /portal/documentos — Repositório de documentos do Portal (VOL09)
 *
 * Mostra documentos gerados pelo admin e partilhados via share-portal (VOL08).
 * Consome: GET /api/portal/documents
 */

import { useEffect, useState, useCallback } from "react";
import PortalLayout from "@/components/portal/PortalLayout";

interface PortalDoc {
  id:          string;
  title:       string;
  type:        string;
  description: string | null;
  createdAt:   string;
  versions: {
    id:         string;
    version:    number;
    createdAt:  string;
    fileSizeBytes: number | null;
  }[];
}

interface Pagination {
  page: number; limit: number; total: number; pages: number;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-AO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtBytes(b: number | null | undefined) {
  if (!b) return "";
  if (b < 1024)        return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_ICON: Record<string, string> = {
  PROPOSAL:    "📊",
  CONTRACT:    "📄",
  DECLARATION: "📃",
  LETTER:      "✉️",
  RECEIPT:     "🧾",
  INVOICE:     "📋",
  OTHER:       "📁",
};

const TYPE_LABEL: Record<string, string> = {
  PROPOSAL:    "Proposta",
  CONTRACT:    "Contrato",
  DECLARATION: "Declaração",
  LETTER:      "Carta",
  RECEIPT:     "Recibo",
  INVOICE:     "Fatura",
  OTHER:       "Documento",
};

function DocumentosContent() {
  const [docs,       setDocs]       = useState<PortalDoc[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [page,       setPage]       = useState(1);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/portal/documents?page=${page}&limit=20`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar documentos.");
      setDocs(json.data ?? []);
      setPagination(json.pagination);
    } catch {
      setError("Não foi possível carregar os documentos.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  async function handleDownload(docId: string) {
    setDownloading(docId);
    try {
      const res  = await fetch(`/api/portal/documents/${docId}/download`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar download.");
      window.open(json.data.url, "_blank");
    } catch {
      alert("Não foi possível gerar o download. Tente novamente.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-10 text-red-600 text-sm">{error}</div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">📁</div>
          <div className="text-gray-500 text-sm">
            Ainda não existem documentos partilhados. O Azul Coworking irá
            disponibilizar propostas, contratos e outros documentos aqui.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const latestVersion = doc.versions?.[0];
            return (
              <div
                key={doc.id}
                className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-4"
              >
                <div className="text-3xl flex-shrink-0 mt-0.5">
                  {TYPE_ICON[doc.type] ?? "📄"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold text-gray-900 leading-tight">
                        {doc.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {TYPE_LABEL[doc.type] ?? doc.type}
                        </span>
                        {latestVersion && (
                          <span className="text-xs text-gray-400">
                            v{latestVersion.version}
                            {latestVersion.fileSizeBytes
                              ? ` · ${fmtBytes(latestVersion.fileSizeBytes)}`
                              : ""}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{fmtDate(doc.createdAt)}</span>
                      </div>
                      {doc.description && (
                        <div className="text-xs text-gray-500 mt-1">{doc.description}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDownload(doc.id)}
                      disabled={downloading === doc.id}
                      className="flex-shrink-0 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {downloading === doc.id ? "..." : "⬇ Descarregar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50"
          >
            ← Anterior
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">{page} / {pagination.pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages || loading}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50"
          >
            Seguinte →
          </button>
        </div>
      )}
    </div>
  );
}

export default function PortalDocumentosPage() {
  return (
    <PortalLayout>
      <DocumentosContent />
    </PortalLayout>
  );
}
