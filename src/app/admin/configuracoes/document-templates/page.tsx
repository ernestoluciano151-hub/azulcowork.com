/**
 * /admin/configuracoes/document-templates — Editor de Templates de Documentos
 *
 * Lista todos os DocumentTemplate, permite editar name/description/htmlBody/isActive inline.
 * Inclui pré-visualização com variáveis de exemplo (POST /preview).
 * Incremento de version automático no backend quando htmlBody muda.
 *
 * Permissões: ADMIN
 * VOL08 — Sprint VOL08-3B
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type DocTemplate = {
  id:          string;
  slug:        string;
  name:        string;
  type:        string;
  description: string | null;
  variables:   string[];
  version:     number;
  isActive:    boolean;
  updatedAt:   string;
};

type DocTemplateDetail = DocTemplate & { htmlBody: string };

type PreviewResult = {
  slug:    string;
  name:    string;
  type:    string;
  version: number;
  html:    string;
  vars:    string[];
  missing: string[];
};

// ─── Labels / cores ───────────────────────────────────────────────────────────
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
function DocumentTemplatesPageInner() {
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState<DocTemplateDetail | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [preview,   setPreview]   = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Vars para preview
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/document-templates");
      if (!r.ok) throw new Error("Erro ao carregar templates");
      const data = await r.json() as { templates: DocTemplate[] };
      setTemplates(data.templates);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);

  // Ao abrir edição, carrega detalhe (com htmlBody)
  async function openEdit(slug: string) {
    const r = await fetch(`/api/admin/document-templates/${slug}`);
    if (!r.ok) { alert("Erro ao carregar template"); return; }
    const data = await r.json() as DocTemplateDetail;
    setEditing(data);
    // Inicializa vars de preview com strings vazias
    const initVars: Record<string, string> = {};
    data.variables.forEach((v) => { initVars[v] = ""; });
    setPreviewVars(initVars);
    setPreview(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/document-templates", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug:        editing.slug,
          name:        editing.name,
          description: editing.description,
          htmlBody:    editing.htmlBody,
          isActive:    editing.isActive,
        }),
      });
      if (!r.ok) throw new Error("Erro ao guardar");
      const saved = await r.json() as { template: DocTemplate; versionBumped: boolean };
      if (saved.versionBumped) {
        alert(`Template guardado. Versão incrementada para v${saved.template.version} (htmlBody modificado).`);
      }
      await fetchTemplates();
      setEditing(null);
      setPreview(null);
    } catch (err) {
      alert(`Erro ao guardar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!editing) return;
    setLoadingPreview(true);
    setPreview(null);
    try {
      const r = await fetch(`/api/admin/document-templates/${editing.slug}/preview`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vars: previewVars }),
      });
      if (!r.ok) throw new Error("Erro ao gerar pré-visualização");
      const data = await r.json() as PreviewResult;
      setPreview(data);
    } catch (err) {
      alert(`Erro na pré-visualização: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingPreview(false);
    }
  }

  // ── Render: lista ───────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="bg-ink p-6 text-paper">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Templates de Documentos</h1>
          <p className="mt-1 text-sm text-mist">
            Configure os templates HTML de propostas, contratos e declarações. A versão incrementa automaticamente quando o corpo do template é modificado.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-mist">
            <span className="animate-pulse">A carregar templates…</span>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((tpl) => (
              <div
                key={tpl.slug}
                className="rounded-xl border border-white/10 bg-ink2 p-5 transition hover:border-white/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOURS[tpl.type] ?? "bg-white/10 text-mist"}`}>
                        {TYPE_LABELS[tpl.type] ?? tpl.type}
                      </span>
                      {!tpl.isActive && (
                        <span className="inline-flex rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-semibold text-paper">{tpl.name}</h3>
                    {tpl.description && (
                      <p className="mt-0.5 text-xs text-mist line-clamp-2">{tpl.description}</p>
                    )}
                    <p className="mt-2 text-xs font-mono text-mist">slug: {tpl.slug}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-xs text-mist font-mono">v{tpl.version}</span>
                    <span className="block text-xs text-mist">{tpl.variables.length} vars</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {tpl.variables.slice(0, 5).map((v) => (
                    <span key={v} className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-mono text-mist">
                      {"{{"}{v}{"}}"}
                    </span>
                  ))}
                  {tpl.variables.length > 5 && (
                    <span className="text-[10px] text-mist">+{tpl.variables.length - 5} mais</span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-mist">{fmtDate(tpl.updatedAt)}</span>
                  <button
                    onClick={() => void openEdit(tpl.slug)}
                    className="rounded-lg bg-azul/15 px-3 py-1.5 text-xs text-azul-glow transition hover:bg-azul/25"
                  >
                    Editar Template →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render: editor ──────────────────────────────────────────────────────────
  return (
    <div className="bg-ink p-6 text-paper">
      {/* Header editor */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <button
            onClick={() => { setEditing(null); setPreview(null); }}
            className="mb-1 text-xs text-mist hover:text-paper"
          >
            ← Voltar à lista
          </button>
          <h1 className="text-xl font-bold">{editing.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOURS[editing.type] ?? "bg-white/10 text-mist"}`}>
              {TYPE_LABELS[editing.type] ?? editing.type}
            </span>
            <span className="text-xs font-mono text-mist">v{editing.version}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void handlePreview()}
            disabled={loadingPreview}
            className="rounded-lg border border-white/10 bg-ink2 px-4 py-2 text-sm text-mist transition hover:bg-white/5 disabled:opacity-50"
          >
            {loadingPreview ? "…" : "👁 Pré-visualizar"}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-azul/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-azul disabled:opacity-50"
          >
            {saving ? "A guardar…" : "💾 Guardar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Coluna esquerda: campos */}
        <div className="space-y-4">
          {/* Nome */}
          <div>
            <label className="mb-1 block text-xs font-medium text-mist">Nome</label>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper focus:outline-none focus:ring-1 focus:ring-azul"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="mb-1 block text-xs font-medium text-mist">Descrição</label>
            <input
              type="text"
              value={editing.description ?? ""}
              onChange={(e) => setEditing({ ...editing, description: e.target.value || null })}
              className="w-full rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper focus:outline-none focus:ring-1 focus:ring-azul"
              placeholder="Descrição opcional"
            />
          </div>

          {/* Estado */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-mist">Template activo</label>
            <button
              onClick={() => setEditing({ ...editing, isActive: !editing.isActive })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${editing.isActive ? "bg-azul" : "bg-white/20"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition ${editing.isActive ? "translate-x-4" : "translate-x-1"}`} />
            </button>
          </div>

          {/* Variáveis */}
          <div>
            <label className="mb-2 block text-xs font-medium text-mist">
              Variáveis disponíveis ({editing.variables.length})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {editing.variables.map((v) => (
                <span key={v} className="rounded bg-white/8 px-1.5 py-0.5 text-[11px] font-mono text-mist">
                  {"{{"}{v}{"}}"}
                </span>
              ))}
            </div>
          </div>

          {/* Vars para preview */}
          <div>
            <label className="mb-2 block text-xs font-medium text-mist">
              Valores para pré-visualização (opcional)
            </label>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {editing.variables.map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 truncate text-[11px] font-mono text-mist">{v}</span>
                  <input
                    type="text"
                    value={previewVars[v] ?? ""}
                    onChange={(e) => setPreviewVars({ ...previewVars, [v]: e.target.value })}
                    placeholder={`{{${v}}}`}
                    className="flex-1 rounded border border-white/10 bg-ink px-2 py-1 text-xs text-paper placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-azul"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna direita: editor HTML */}
        <div className="flex flex-col">
          <label className="mb-1 block text-xs font-medium text-mist">
            Corpo do Template (HTML) — versão actual: v{editing.version}
            <span className="ml-1 text-amber-400/70">· guardar com htmlBody alterado incrementa a versão</span>
          </label>
          <textarea
            value={editing.htmlBody}
            onChange={(e) => setEditing({ ...editing, htmlBody: e.target.value })}
            className="flex-1 min-h-[480px] w-full resize-y rounded-lg border border-white/10 bg-ink2 p-3 font-mono text-xs text-paper focus:outline-none focus:ring-1 focus:ring-azul"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Pré-visualização */}
      {preview && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-paper">Pré-visualização — v{preview.version}</h3>
              {preview.missing.length > 0 && (
                <p className="mt-0.5 text-xs text-amber-400">
                  Variáveis não preenchidas (marcadas com [PLACEHOLDER]):&nbsp;
                  {preview.missing.join(", ")}
                </p>
              )}
            </div>
            <button
              onClick={() => setPreview(null)}
              className="text-xs text-mist hover:text-paper"
            >
              ✕ Fechar
            </button>
          </div>
          <div className="rounded-xl border border-white/10 bg-white overflow-hidden">
            <iframe
              srcDoc={preview.html}
              sandbox="allow-same-origin"
              className="h-[600px] w-full"
              title="Pré-visualização do documento"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Navegação consistente: sidebar persistente à esquerda, conteúdo à direita
export default function DocumentTemplatesPage() {
  return (
    <AdminLayout>
      <DocumentTemplatesPageInner />
    </AdminLayout>
  );
}
