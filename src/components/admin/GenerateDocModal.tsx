/**
 * GenerateDocModal — Modal de geração de documentos PDF
 *
 * Reutilizável em qualquer página admin.
 * Chama POST /api/admin/documents/generate e retorna resultado (download + share).
 *
 * Props:
 *   isOpen         — controla visibilidade
 *   onClose        — callback ao fechar
 *   entityType     — "COMPANY" | "LEAD" | "ERPCONTRACT"
 *   entityId       — id da entidade
 *   entityName     — nome da entidade (para display)
 *   defaultSlug    — slug do template pré-seleccionado (opcional)
 *   prefillVars    — variáveis pré-preenchidas a partir da entidade
 *
 * VOL08 — Sprint VOL08-3C
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface DocTemplate {
  slug:        string;
  name:        string;
  type:        string;
  description: string | null;
  variables:   string[];
  version:     number;
  isActive:    boolean;
}

interface GenerateResult {
  id:              string;
  version:         number;
  templateVersion: number;
  fileName:        string;
  fileSizeBytes:   number;
  sha256Hash:      string;
  generatedAt:     string;
}

interface Props {
  isOpen:      boolean;
  onClose:     () => void;
  entityType:  "COMPANY" | "LEAD" | "ERPCONTRACT";
  entityId:    string;
  entityName:  string;
  defaultSlug?: string;
  prefillVars?: Record<string, string>;
}

const TYPE_LABELS: Record<string, string> = {
  PROPOSAL:    "Proposta",
  CONTRACT:    "Contrato",
  DECLARATION: "Declaração",
  LETTER:      "Carta",
};

function fmtBytes(n: number) {
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function GenerateDocModal({
  isOpen, onClose,
  entityType, entityId, entityName,
  defaultSlug, prefillVars = {},
}: Props) {
  const [templates,    setTemplates]    = useState<DocTemplate[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(defaultSlug ?? "");
  const [vars,         setVars]         = useState<Record<string, string>>(prefillVars);
  const [generating,   setGenerating]   = useState(false);
  const [result,       setResult]       = useState<GenerateResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [downloadUrl,  setDownloadUrl]  = useState<string | null>(null);
  const [sharing,      setSharing]      = useState(false);
  const [shared,       setShared]       = useState(false);

  const selectedTemplate = templates.find((t) => t.slug === selectedSlug);

  // Carregar templates ao abrir
  const loadTemplates = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/document-templates");
      if (!r.ok) return;
      const data = await r.json() as { templates: DocTemplate[] };
      const active = data.templates.filter((t) => t.isActive);
      setTemplates(active);
      // Se há um default válido, usar; caso contrário usar o primeiro
      if (!defaultSlug && active.length > 0) {
        setSelectedSlug(active[0].slug);
      }
    } catch { /* silencioso */ }
  }, [defaultSlug]);

  useEffect(() => {
    if (isOpen) {
      void loadTemplates();
      setResult(null);
      setError(null);
      setDownloadUrl(null);
      setShared(false);
      // Reset vars com prefill
      setVars(prefillVars);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Quando muda template, inicializa vars faltantes
  useEffect(() => {
    if (!selectedTemplate) return;
    setVars((prev) => {
      const next = { ...prev };
      selectedTemplate.variables.forEach((v) => {
        if (!(v in next)) next[v] = "";
      });
      return next;
    });
  }, [selectedTemplate]);

  async function handleGenerate() {
    if (!selectedSlug) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    setDownloadUrl(null);

    try {
      const r = await fetch("/api/admin/documents/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateSlug: selectedSlug,
          entityType,
          entityId,
          vars,
        }),
      });

      const data = await r.json() as { message?: string; document?: GenerateResult; error?: string };

      if (!r.ok) {
        setError(data.error ?? "Erro ao gerar documento");
        return;
      }

      if (data.document) {
        setResult(data.document);
        // Obter URL de download imediatamente
        const dlr = await fetch(`/api/admin/documents/${data.document.id}`);
        if (dlr.ok) {
          const dlData = await dlr.json() as { downloadUrl: string };
          setDownloadUrl(dlData.downloadUrl);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede");
    } finally {
      setGenerating(false);
    }
  }

  async function handleShare() {
    if (!result) return;
    setSharing(true);
    try {
      const r = await fetch(`/api/admin/documents/${result.id}/share-portal`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (r.ok) {
        setShared(true);
      } else {
        const d = await r.json() as { error?: string };
        alert(d.error ?? "Erro ao partilhar no portal");
      }
    } catch {
      alert("Erro de rede ao partilhar");
    } finally {
      setSharing(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-ink2 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <h2 className="text-lg font-bold text-paper">Gerar Documento</h2>
            <p className="mt-0.5 text-sm text-mist">{entityName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-mist transition hover:bg-white/5 hover:text-paper"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {!result ? (
            <div className="space-y-5">
              {/* Selector de template */}
              <div>
                <label className="mb-2 block text-xs font-medium text-mist">Template de documento</label>
                <select
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper focus:outline-none focus:ring-1 focus:ring-azul"
                >
                  <option value="" disabled>Seleccionar template…</option>
                  {templates.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {TYPE_LABELS[t.type] ?? t.type} — {t.name} (v{t.version})
                    </option>
                  ))}
                </select>
                {selectedTemplate?.description && (
                  <p className="mt-1 text-xs text-mist">{selectedTemplate.description}</p>
                )}
              </div>

              {/* Variáveis */}
              {selectedTemplate && selectedTemplate.variables.length > 0 && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-mist">
                    Variáveis do template
                    <span className="ml-2 text-mist/60">— campos pré-preenchidos podem ser editados</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTemplate.variables.map((v) => (
                      <div key={v}>
                        <label className="mb-0.5 block text-[10px] font-mono text-mist/70">{v}</label>
                        <input
                          type="text"
                          value={vars[v] ?? ""}
                          onChange={(e) => setVars({ ...vars, [v]: e.target.value })}
                          placeholder={`{{${v}}}`}
                          className="w-full rounded border border-white/10 bg-ink px-2 py-1.5 text-xs text-paper placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-azul"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Erro */}
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}
            </div>
          ) : (
            /* Resultado da geração */
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-emerald-300">Documento gerado com sucesso</p>
                  <p className="text-xs text-mist">{result.fileName} · {fmtBytes(result.fileSizeBytes)} · v{result.version}</p>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-ink p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-mist">Versão do documento</span>
                  <span className="font-mono text-paper">v{result.version}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-mist">Versão do template</span>
                  <span className="font-mono text-paper">v{result.templateVersion}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-mist">SHA-256</span>
                  <span className="font-mono text-paper text-[10px] truncate max-w-[200px]">{result.sha256Hash.slice(0, 16)}…</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-mist">Gerado em</span>
                  <span className="text-paper">{new Date(result.generatedAt).toLocaleString("pt-AO")}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg bg-azul/80 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-azul"
                  >
                    ⬇ Transferir PDF
                    <span className="text-xs font-normal opacity-70">(URL expira em 15 min)</span>
                  </a>
                )}
                <button
                  onClick={() => void handleShare()}
                  disabled={sharing || shared}
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-ink px-4 py-2.5 text-sm text-mist transition hover:bg-white/5 disabled:opacity-50"
                >
                  {shared ? "✅ Partilhado no Portal do Cliente" : sharing ? "A partilhar…" : "🌐 Partilhar no Portal do Cliente"}
                </button>
                <button
                  onClick={() => { setResult(null); setDownloadUrl(null); setShared(false); }}
                  className="text-xs text-mist hover:text-paper transition"
                >
                  ← Gerar outro documento
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div className="flex items-center justify-end gap-3 border-t border-white/10 p-4">
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist transition hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleGenerate()}
              disabled={!selectedSlug || generating}
              className="rounded-lg bg-azul/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-azul disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  A gerar PDF…
                </span>
              ) : (
                "📄 Gerar Documento"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
