"use client";

/**
 * /admin/crm/[id] — Customer 360°
 * Vista completa da empresa: header + tabs (Deals, Contacts, Activities, Tasks, Notes) + Timeline lateral
 * Inspiração: HubSpot Contact Record · Salesforce Account
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter }             from "next/navigation";
import Link                                 from "next/link";
import AdminLayout                          from "@/components/admin/AdminLayout";
import GenerateDocModal                     from "@/components/admin/GenerateDocModal";
import type {
  Company360, CrmDeal, CrmContact, CrmActivity,
  CrmTask, CrmNote, TimelineEntry,
  PipelineStage, DealStage, TaskPriority,
} from "@/types/crm";
import {
  PIPELINE_STAGE_LABELS, PIPELINE_STAGE_COLORS,
  DEAL_STAGE_LABELS, DEAL_STAGE_COLORS,
  COMPANY_STATUS_LABELS,
  TASK_PRIORITY_COLORS,
  ACTIVITY_TYPE_ICONS,
  formatKzCRM, fullName,
} from "@/types/crm";

// ── Utilitários ───────────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-paper">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-center text-sm text-mist">{text}</p>;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `há ${days}d`;
  return new Date(iso).toLocaleDateString("pt-AO");
}

// ── Header da empresa ─────────────────────────────────────────────────────────

function CompanyHeader({ company, onRefresh }: { company: Company360; onRefresh: () => void }) {
  const [editing,     setEditing]     = useState(false);
  const [stage,       setStage]       = useState<PipelineStage | "">(company.pipelineStage ?? "");
  const [saving,      setSaving]      = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docDefaultSlug, setDocDefaultSlug] = useState("proposta-coworking");

  // Vars pré-preenchidas a partir dos dados da empresa
  const prefillVars: Record<string, string> = {
    nomeEmpresa:    company.name ?? "",
    nifEmpresa:     company.nif ?? "",
    moradaEmpresa:  company.address ?? "",
    emailContacto:  company.email ?? "",
    nomeContacto:   company.crmContacts?.[0]
                      ? `${company.crmContacts[0].firstName ?? ""} ${company.crmContacts[0].lastName ?? ""}`.trim()
                      : "",
    telefoneContacto: company.phone ?? "",
    dataDocumento:  new Date().toLocaleDateString("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric" }),
  };

  async function saveStage() {
    if (!stage) return;
    setSaving(true);
    await fetch(`/api/crm/companies/${company.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ pipelineStage: stage }),
    });
    setSaving(false);
    setEditing(false);
    onRefresh();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Nome + Stage */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-azul/20 text-xl font-bold text-azul-glow">
              {company.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-paper">{company.name}</h1>
              {company.nif && <p className="text-xs text-mist mt-0.5">NIF: {company.nif}</p>}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {editing ? (
              <div className="flex items-center gap-2">
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as PipelineStage)}
                  className="focus-ring rounded-lg border border-white/10 bg-ink px-2 py-1 text-sm text-paper"
                >
                  {(Object.keys(PIPELINE_STAGE_LABELS) as PipelineStage[]).map(s => (
                    <option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>
                  ))}
                </select>
                <button onClick={saveStage} disabled={saving} className="rounded-lg bg-azul px-3 py-1 text-xs font-semibold text-white hover:bg-azul-dim disabled:opacity-50">
                  {saving ? "…" : "Guardar"}
                </button>
                <button onClick={() => setEditing(false)} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-mist hover:bg-white/5">
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                {company.pipelineStage && (
                  <button onClick={() => setEditing(true)} title="Alterar stage">
                    <Badge
                      label={PIPELINE_STAGE_LABELS[company.pipelineStage]}
                      className={`${PIPELINE_STAGE_COLORS[company.pipelineStage]} cursor-pointer hover:opacity-80 transition`}
                    />
                  </button>
                )}
                {company.crmStatus && (
                  <span className="text-xs text-mist">
                    {COMPANY_STATUS_LABELS[company.crmStatus]}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Metadados */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          {company.email && (
            <div>
              <p className="text-xs text-mist">E-mail</p>
              <a href={`mailto:${company.email}`} className="text-azul-glow hover:underline">{company.email}</a>
            </div>
          )}
          {company.sector && (
            <div>
              <p className="text-xs text-mist">Sector</p>
              <p className="text-paper">{company.sector}</p>
            </div>
          )}
          {company.country && (
            <div>
              <p className="text-xs text-mist">País</p>
              <p className="text-paper">{company.country}</p>
            </div>
          )}
          {company.website && (
            <div>
              <p className="text-xs text-mist">Website</p>
              <a href={company.website} target="_blank" rel="noreferrer" className="text-azul-glow hover:underline truncate block">{company.website}</a>
            </div>
          )}
          {company.assignedTo && (
            <div>
              <p className="text-xs text-mist">Responsável</p>
              <p className="text-paper">{company.assignedTo.name ?? company.assignedTo.email}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-mist">Criado em</p>
            <p className="text-paper">{new Date(company.createdAt).toLocaleDateString("pt-AO")}</p>
          </div>
        </div>
      </div>

      {/* Tags */}
      {company.companyTags && company.companyTags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {company.companyTags.map((t) => (
            <span
              key={t.tagId}
              className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-mist"
              style={t.color ? { borderColor: t.color + "40", color: t.color } : {}}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      {/* Acções de Documentos (VOL08) */}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/5 pt-4">
        <button
          onClick={() => { setDocDefaultSlug("proposta-coworking"); setShowDocModal(true); }}
          className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition hover:bg-blue-500/20"
        >
          📄 Gerar Proposta
        </button>
        <button
          onClick={() => { setDocDefaultSlug("contrato-coworking"); setShowDocModal(true); }}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        >
          📃 Gerar Contrato
        </button>
        <a
          href="/admin/documentos"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-mist transition hover:text-paper"
        >
          📚 Ver todos os documentos
        </a>
      </div>

      {/* Modal de geração */}
      <GenerateDocModal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        entityType="COMPANY"
        entityId={company.id}
        entityName={company.name}
        defaultSlug={docDefaultSlug}
        prefillVars={prefillVars}
      />
    </div>
  );
}

// ── Tab: Deals ────────────────────────────────────────────────────────────────

function DealsTab({ companyId, deals, onRefresh }: { companyId: string; deals: CrmDeal[]; onRefresh: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle]     = useState("");
  const [value, setValue]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  async function createDeal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true); setError("");
    const res = await fetch(`/api/crm/companies/${companyId}/deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), value: value ? parseFloat(value) : undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Erro ao criar deal."); setSaving(false); return; }
    setShowNew(false); setTitle(""); setValue(""); setSaving(false);
    onRefresh();
  }

  const active = deals.filter(d => d.stage !== "WON" && d.stage !== "LOST");
  const closed = deals.filter(d => d.stage === "WON" || d.stage === "LOST");

  return (
    <Section
      title={`Deals (${deals.length})`}
      action={
        <button onClick={() => setShowNew(!showNew)} className="rounded-lg bg-azul/15 px-3 py-1 text-xs font-medium text-azul-glow hover:bg-azul/25 transition">
          + Novo Deal
        </button>
      }
    >
      {showNew && (
        <form onSubmit={createDeal} className="mb-4 rounded-xl border border-white/10 bg-ink p-4">
          <div className="flex flex-wrap gap-3">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título do deal *"
              className="focus-ring flex-1 min-w-[180px] rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper placeholder:text-mist/50"
              autoFocus
            />
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Valor (Kz)"
              className="focus-ring w-36 rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper placeholder:text-mist/50"
            />
            <button type="submit" disabled={saving} className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-50">
              {saving ? "…" : "Criar"}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-mist hover:bg-white/5">✕</button>
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </form>
      )}

      {deals.length === 0 && <Empty text="Nenhum deal. Cria o primeiro acima." />}

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(d => (
            <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-ink p-3">
              <div>
                <p className="text-sm font-medium text-paper">{d.title}</p>
                <p className="text-xs text-mist">{d.value ? formatKzCRM(d.value) : "Sem valor definido"}</p>
              </div>
              <Badge label={DEAL_STAGE_LABELS[d.stage as DealStage]} className={DEAL_STAGE_COLORS[d.stage as DealStage]} />
            </div>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-mist">Fechados</p>
          <div className="space-y-2">
            {closed.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-ink/50 p-3 opacity-60">
                <div>
                  <p className="text-sm text-paper">{d.title}</p>
                  {d.closedAt && <p className="text-xs text-mist">{new Date(d.closedAt).toLocaleDateString("pt-AO")}</p>}
                </div>
                <Badge label={DEAL_STAGE_LABELS[d.stage as DealStage]} className={DEAL_STAGE_COLORS[d.stage as DealStage]} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

// ── Tab: Contactos ────────────────────────────────────────────────────────────

function ContactsTab({ companyId, contacts, onRefresh }: { companyId: string; contacts: CrmContact[]; onRefresh: () => void }) {
  const [showNew, setShowNew]     = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true); setError("");
    const res = await fetch(`/api/crm/companies/${companyId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Erro."); setSaving(false); return; }
    setShowNew(false); setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setSaving(false);
    onRefresh();
  }

  return (
    <Section
      title={`Contactos (${contacts.length})`}
      action={
        <button onClick={() => setShowNew(!showNew)} className="rounded-lg bg-azul/15 px-3 py-1 text-xs font-medium text-azul-glow hover:bg-azul/25 transition">
          + Contacto
        </button>
      }
    >
      {showNew && (
        <form onSubmit={createContact} className="mb-4 rounded-xl border border-white/10 bg-ink p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nome *" className="focus-ring rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper placeholder:text-mist/50" autoFocus />
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apelido *" className="focus-ring rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper placeholder:text-mist/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="focus-ring rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper placeholder:text-mist/50" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefone" className="focus-ring rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper placeholder:text-mist/50" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-mist hover:bg-white/5">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-azul px-4 py-1.5 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-50">{saving ? "…" : "Adicionar"}</button>
          </div>
        </form>
      )}

      {contacts.length === 0 && <Empty text="Nenhum contacto." />}
      <div className="space-y-2">
        {contacts.map(c => (
          <div key={c.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-ink p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-azul/10 text-sm font-bold text-azul-glow">
              {c.firstName[0]}{c.lastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-paper">
                {fullName(c)}
                {c.isPrimary && <span className="ml-2 text-[10px] font-semibold text-azul-glow">PRINCIPAL</span>}
              </p>
              <p className="text-xs text-mist truncate">{[c.email, c.phone].filter(Boolean).join(" · ") || "Sem contacto"}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Tab: Actividades ──────────────────────────────────────────────────────────

function ActivitiesTab({ companyId, activities, onRefresh }: { companyId: string; activities: CrmActivity[]; onRefresh: () => void }) {
  const [showNew, setShowNew]   = useState(false);
  const [type, setType]         = useState("CALL");
  const [summary, setSummary]   = useState("");
  const [direction, setDirection] = useState("OUTBOUND");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  async function createActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;
    setSaving(true); setError("");
    const res = await fetch(`/api/crm/companies/${companyId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, summary: summary.trim(), direction }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Erro."); setSaving(false); return; }
    setShowNew(false); setSummary(""); setSaving(false);
    onRefresh();
  }

  return (
    <Section
      title={`Actividades (${activities.length})`}
      action={
        <button onClick={() => setShowNew(!showNew)} className="rounded-lg bg-azul/15 px-3 py-1 text-xs font-medium text-azul-glow hover:bg-azul/25 transition">
          + Actividade
        </button>
      }
    >
      {showNew && (
        <form onSubmit={createActivity} className="mb-4 rounded-xl border border-white/10 bg-ink p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={type} onChange={e => setType(e.target.value)} className="focus-ring rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper">
              {[["CALL","Chamada"],["EMAIL","E-mail"],["MEETING","Reunião"],["WHATSAPP","WhatsApp"],["VISIT","Visita"],["PROPOSAL","Proposta"],["OTHER","Outra"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={direction} onChange={e => setDirection(e.target.value)} className="focus-ring rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper">
              <option value="OUTBOUND">Saída (iniciativa nossa)</option>
              <option value="INBOUND">Entrada (iniciativa deles)</option>
            </select>
          </div>
          <input value={summary} onChange={e => setSummary(e.target.value)} placeholder="Resumo *" className="focus-ring w-full rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper placeholder:text-mist/50" autoFocus />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-mist hover:bg-white/5">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-azul px-4 py-1.5 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-50">{saving ? "…" : "Registar"}</button>
          </div>
        </form>
      )}

      {activities.length === 0 && <Empty text="Nenhuma actividade registada." />}
      <div className="space-y-2">
        {activities.map(a => (
          <div key={a.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-ink p-3">
            <span className="mt-0.5 text-lg" aria-hidden>{ACTIVITY_TYPE_ICONS[a.type as keyof typeof ACTIVITY_TYPE_ICONS] ?? "📌"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-paper truncate">{a.summary}</p>
              <p className="text-xs text-mist">{a.direction === "OUTBOUND" ? "Saída" : "Entrada"} · {relativeTime(a.occurredAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Tab: Tasks ────────────────────────────────────────────────────────────────

function TasksTab({ companyId, tasks, onRefresh }: { companyId: string; tasks: CrmTask[]; onRefresh: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle]     = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true); setError("");
    const res = await fetch(`/api/crm/companies/${companyId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), priority, dueDate: dueDate || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Erro."); setSaving(false); return; }
    setShowNew(false); setTitle(""); setDueDate(""); setSaving(false);
    onRefresh();
  }

  async function toggleDone(task: CrmTask) {
    const newStatus = task.status === "DONE" ? "PENDING" : "DONE";
    await fetch(`/api/crm/companies/${companyId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    onRefresh();
  }

  const pending = tasks.filter(t => t.status !== "DONE" && t.status !== "CANCELLED");
  const done    = tasks.filter(t => t.status === "DONE");
  const now     = Date.now();

  return (
    <Section
      title={`Tasks (${pending.length} pendentes)`}
      action={
        <button onClick={() => setShowNew(!showNew)} className="rounded-lg bg-azul/15 px-3 py-1 text-xs font-medium text-azul-glow hover:bg-azul/25 transition">
          + Task
        </button>
      }
    >
      {showNew && (
        <form onSubmit={createTask} className="mb-4 rounded-xl border border-white/10 bg-ink p-4 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da task *" className="focus-ring w-full rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper placeholder:text-mist/50" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="focus-ring rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper">
              {[["LOW","Baixa"],["MEDIUM","Média"],["HIGH","Alta"],["URGENT","Urgente"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="focus-ring rounded-lg border border-white/10 bg-ink2 px-3 py-2 text-sm text-paper" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-mist hover:bg-white/5">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-azul px-4 py-1.5 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-50">{saving ? "…" : "Criar Task"}</button>
          </div>
        </form>
      )}

      {tasks.length === 0 && <Empty text="Nenhuma task." />}
      <div className="space-y-2">
        {pending.map(t => {
          const overdue = t.dueDate && new Date(t.dueDate).getTime() < now;
          return (
            <div key={t.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-ink p-3">
              <button onClick={() => toggleDone(t)} className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/20 hover:border-azul hover:bg-azul/10 transition" title="Marcar como concluída" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-paper">{t.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge label={t.priority} className={TASK_PRIORITY_COLORS[t.priority as TaskPriority]} />
                  {t.dueDate && (
                    <span className={`text-xs ${overdue ? "text-red-400" : "text-mist"}`}>
                      {overdue ? "⚠ " : ""}{new Date(t.dueDate).toLocaleDateString("pt-AO")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {done.length > 0 && (
          <p className="mt-3 text-xs text-mist">{done.length} task(s) concluída(s)</p>
        )}
      </div>
    </Section>
  );
}

// ── Tab: Notas ────────────────────────────────────────────────────────────────

function NotesTab({ companyId, notes, onRefresh }: { companyId: string; notes: CrmNote[]; onRefresh: () => void }) {
  const [content, setContent] = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  async function createNote(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true); setError("");
    const res = await fetch(`/api/crm/companies/${companyId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Erro."); setSaving(false); return; }
    setContent(""); setSaving(false);
    onRefresh();
  }

  return (
    <Section title={`Notas (${notes.length})`}>
      <form onSubmit={createNote} className="mb-4">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Escreve uma nota interna sobre esta empresa…"
          rows={3}
          className="focus-ring w-full rounded-xl border border-white/10 bg-ink px-3 py-2.5 text-sm text-paper placeholder:text-mist/50 resize-none"
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        <div className="mt-2 flex justify-end">
          <button type="submit" disabled={saving || !content.trim()} className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-50 transition">
            {saving ? "A guardar…" : "Guardar Nota"}
          </button>
        </div>
      </form>

      {notes.length === 0 && <Empty text="Nenhuma nota interna." />}
      <div className="space-y-3">
        {notes.map(n => (
          <div key={n.id} className="rounded-xl border border-white/10 bg-ink p-3">
            <p className="text-sm text-paper whitespace-pre-wrap">{n.content}</p>
            <p className="mt-2 text-xs text-mist">{relativeTime(n.createdAt)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Timeline lateral ──────────────────────────────────────────────────────────

const TIMELINE_ICONS: Record<string, string> = {
  COMPANY_CREATED:   "🏗️",
  STAGE_CHANGED:     "🔄",
  STATUS_CHANGED:    "✏️",
  OWNER_CHANGED:     "👤",
  DEAL_CREATED:      "💼",
  DEAL_WON:          "🏆",
  DEAL_LOST:         "❌",
  DEAL_STAGE_CHANGED:"📊",
  CONTACT_CREATED:   "👤",
  ACTIVITY_LOGGED:   "📌",
  NOTE_ADDED:        "📝",
  TASK_CREATED:      "✅",
  TASK_COMPLETED:    "✔️",
  CALL_LOGGED:       "📞",
  EMAIL_SENT:        "✉️",
  MEETING_HELD:      "🤝",
  WHATSAPP_SENT:     "💬",
  INVOICE_CREATED:   "🧾",
  PAYMENT_RECEIVED:  "💵",
  RESERVATION_MADE:  "📅",
  COMPANY_MERGED:    "🔀",
};

function TimelineSidebar({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="mb-4 text-sm font-semibold text-paper">Timeline</h3>
      {entries.length === 0 && <p className="text-sm text-mist">Sem eventos registados.</p>}
      <div className="relative space-y-0">
        {entries.map((entry, idx) => (
          <div key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Linha vertical */}
            {idx < entries.length - 1 && (
              <div className="absolute left-4 top-8 h-[calc(100%-8px)] w-px bg-white/10" />
            )}
            {/* Ícone */}
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-ink text-sm">
              {TIMELINE_ICONS[entry.eventType] ?? "📌"}
            </div>
            {/* Conteúdo */}
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-xs font-medium text-paper leading-snug">{entry.title}</p>
              {entry.description && (
                <p className="mt-0.5 text-xs text-mist line-clamp-2">{entry.description}</p>
              )}
              <p className="mt-1 text-[10px] text-mist/60">
                {entry.actorName && <span>{entry.actorName} · </span>}
                {relativeTime(entry.occurredAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type Tab = "deals" | "contacts" | "activities" | "tasks" | "notes";

export default function Customer360Page() {
  const params   = useParams<{ id: string }>();
  const router   = useRouter();
  const id       = params.id;

  const [company, setCompany] = useState<Company360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [tab, setTab]         = useState<Tab>("deals");

  const fetchCompany = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/crm/companies/${id}`);
      if (res.status === 404) { router.push("/admin/crm"); return; }
      if (!res.ok) { setError("Erro ao carregar empresa."); return; }
      setCompany(await res.json());
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-azul border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !company) {
    return (
      <AdminLayout>
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <p className="text-sm text-red-400">{error || "Empresa não encontrada."}</p>
          <Link href="/admin/crm" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5">← Voltar</Link>
        </div>
      </AdminLayout>
    );
  }

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "deals",      label: "Deals",       count: company.crmDeals?.length },
    { key: "contacts",   label: "Contactos",   count: company.crmContacts?.length },
    { key: "activities", label: "Actividades", count: company.crmActivities?.length },
    { key: "tasks",      label: "Tasks",       count: company.crmTasks?.filter(t => t.status !== "DONE").length },
    { key: "notes",      label: "Notas",       count: company.crmNotes?.length },
  ];

  return (
    <AdminLayout>
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm text-mist">
        <Link href="/admin/crm" className="hover:text-paper transition">Empresas CRM</Link>
        <span>/</span>
        <span className="text-paper truncate max-w-xs">{company.name}</span>
      </div>

      <div className="flex gap-6">
        {/* Coluna principal */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Header */}
          <CompanyHeader company={company} onRefresh={fetchCompany} />

          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
                  tab === t.key
                    ? "bg-azul/15 text-paper"
                    : "text-mist hover:text-paper"
                ].join(" ")}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Conteúdo da tab */}
          {tab === "deals"      && <DealsTab      companyId={id} deals={company.crmDeals ?? []}      onRefresh={fetchCompany} />}
          {tab === "contacts"   && <ContactsTab   companyId={id} contacts={company.crmContacts ?? []}   onRefresh={fetchCompany} />}
          {tab === "activities" && <ActivitiesTab companyId={id} activities={company.crmActivities ?? []} onRefresh={fetchCompany} />}
          {tab === "tasks"      && <TasksTab      companyId={id} tasks={company.crmTasks ?? []}      onRefresh={fetchCompany} />}
          {tab === "notes"      && <NotesTab      companyId={id} notes={company.crmNotes ?? []}      onRefresh={fetchCompany} />}
        </div>

        {/* Timeline lateral */}
        <div className="hidden w-72 shrink-0 xl:block">
          <TimelineSidebar entries={company.crmTimeline ?? []} />
        </div>
      </div>
    </AdminLayout>
  );
}
