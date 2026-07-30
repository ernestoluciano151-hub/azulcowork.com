"use client";

/**
 * /admin/configuracoes/email-templates — Gestão de Templates Email
 *
 * Lista todos os templates, permite editar subject/htmlBody inline.
 * Inclui pré-visualização com variáveis de exemplo.
 * VOL07 — Sprint VOL07-3
 */

import { useEffect, useState, useCallback } from "react";

type EmailTemplate = {
  id:        string;
  slug:      string;
  name:      string;
  subject:   string;
  htmlBody:  string;
  variables: string[];
  category:  string;
  isActive:  boolean;
  updatedAt: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  crm:        "CRM",
  reservas:   "Reservas",
  financeiro: "Financeiro",
};

const CATEGORY_COLORS: Record<string, string> = {
  crm:        "bg-purple-500/20 text-purple-300",
  reservas:   "bg-blue-500/20 text-blue-300",
  financeiro: "bg-amber-500/20 text-amber-300",
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<EmailTemplate | null>(null);
  const [saving, setSaving]       = useState(false);
  const [preview, setPreview]     = useState<{ subject: string; html: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates");
      if (!res.ok) throw new Error("Erro ao carregar templates");
      const data = await res.json() as { templates: EmailTemplate[] };
      setTemplates(data.templates);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug:     editing.slug,
          name:     editing.name,
          subject:  editing.subject,
          htmlBody: editing.htmlBody,
          isActive: editing.isActive,
        }),
      });
      if (!res.ok) throw new Error("Erro ao guardar");
      await fetchTemplates();
      setEditing(null);
      setPreview(null);
    } catch (err) {
      alert(`Erro ao guardar template: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!editing) return;
    setLoadingPreview(true);
    setPreview(null);
    try {
      const sampleVars: Record<string, string> = {};
      for (const v of editing.variables) {
        sampleVars[v] = `[${v.toUpperCase()}]`;
      }
      const res = await fetch(`/api/admin/email-templates/${editing.slug}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vars: sampleVars }),
      });
      if (!res.ok) throw new Error("Erro ao gerar pré-visualização");
      const data = await res.json() as { subject: string; html: string };
      setPreview(data);
    } finally {
      setLoadingPreview(false);
    }
  }

  // Agrupar por categoria
  const grouped = templates.reduce<Record<string, EmailTemplate[]>>((acc, t) => {
    (acc[t.category] = acc[t.category] ?? []).push(t);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <span className="text-slate-400">A carregar templates...</span>
      </div>
    );
  }

  // ── Modo edição ───────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="min-h-screen bg-gray-950 text-slate-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <button
                onClick={() => { setEditing(null); setPreview(null); }}
                className="text-slate-400 hover:text-white text-sm mb-2 inline-flex items-center gap-1"
              >
                ← Voltar
              </button>
              <h1 className="text-xl font-bold text-white">{editing.name}</h1>
              <p className="text-slate-400 text-xs font-mono mt-1">{editing.slug}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void handlePreview()}
                disabled={loadingPreview}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
              >
                {loadingPreview ? "..." : "👁 Pré-visualizar"}
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {saving ? "A guardar..." : "💾 Guardar"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Nome */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Template</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Assunto (Subject)</label>
              <input
                type="text"
                value={editing.subject}
                onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            {/* Variáveis disponíveis */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Variáveis disponíveis (clicar para inserir)
              </label>
              <div className="flex flex-wrap gap-2">
                {editing.variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      // Inserir no subject (foco activo determinado pelo último campo activo — simplificação: inserir no subject)
                      setEditing({ ...editing, subject: editing.subject + `{{${v}}}` });
                    }}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-slate-300 text-xs px-2 py-1 rounded font-mono"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* HTML Body */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                HTML Body
                <span className="ml-2 text-slate-500">(usar {`{{variavel}}`} para substituições)</span>
              </label>
              <textarea
                value={editing.htmlBody}
                onChange={(e) => setEditing({ ...editing, htmlBody: e.target.value })}
                rows={20}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono resize-y"
              />
            </div>

            {/* Activo */}
            <div className="flex items-center gap-3">
              <input
                id="isActive"
                type="checkbox"
                checked={editing.isActive}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="isActive" className="text-sm text-slate-300">Template activo</label>
            </div>

            {/* Pré-visualização */}
            {preview && (
              <div className="border border-gray-700 rounded-xl overflow-hidden">
                <div className="bg-gray-800 px-4 py-2 text-xs text-slate-400">
                  <strong className="text-white">Assunto pré-visualizado:</strong> {preview.subject}
                </div>
                <iframe
                  srcDoc={preview.html}
                  title="Email preview"
                  className="w-full h-[500px] bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Lista ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-slate-200 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">✉️ Templates de Email</h1>
        <p className="text-slate-400 text-sm mt-1">
          Edite os templates de email enviados automaticamente pelo sistema.
          Use {`{{variavel}}`} para substituições dinâmicas.
        </p>
      </div>

      {Object.entries(grouped).map(([category, tpls]) => (
        <div key={category} className="mb-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {tpls.map((tpl) => (
              <div
                key={tpl.slug}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between gap-4 hover:border-gray-700 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[category] ?? "bg-gray-700 text-gray-300"}`}>
                      {CATEGORY_LABELS[category] ?? category}
                    </span>
                    {!tpl.isActive && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-300">
                        Inactivo
                      </span>
                    )}
                    <span className="text-slate-500 font-mono text-xs">{tpl.slug}</span>
                  </div>
                  <p className="text-white font-medium text-sm">{tpl.name}</p>
                  <p className="text-slate-400 text-xs mt-1 truncate">{tpl.subject}</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Variáveis: {tpl.variables.join(", ")}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    // Carregar htmlBody completo
                    const res = await fetch(`/api/admin/email-templates/${tpl.slug}`);
                    const data = await res.json() as { template: EmailTemplate };
                    setEditing(data.template);
                  }}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm shrink-0"
                >
                  ✏️ Editar
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
