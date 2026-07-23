"use client";

import { useEffect, useState } from "react";

interface Employee {
  id: string;
  companyId: string;
  name: string;
  role: string;
  department: string | null;
  phone: string | null;
  email: string | null;
  startDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  ATIVO:    "bg-emerald-500/15 text-emerald-300",
  INATIVO:  "bg-zinc-500/15 text-zinc-400",
  AFASTADO: "bg-amber-500/15 text-amber-300",
};

const STATUS_LABELS: Record<string, string> = {
  ATIVO:    "Ativo",
  INATIVO:  "Inativo",
  AFASTADO: "Afastado",
};

const EMPTY: Omit<Employee, "id" | "companyId" | "createdAt"> = {
  name: "", role: "", department: "", phone: "", email: "",
  startDate: "", status: "ATIVO", notes: "",
};

interface Props {
  companyId: string;
}

export default function EmployeesPanel({ companyId }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState({ ...EMPTY });
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/employees?companyId=${companyId}`);
    if (res.ok) {
      const data = await res.json();
      setEmployees(data.employees);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [companyId]);

  function startCreate() {
    setForm({ ...EMPTY });
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(emp: Employee) {
    setForm({
      name:       emp.name ?? "",
      role:       emp.role ?? "",
      department: emp.department ?? "",
      phone:      emp.phone      ?? "",
      email:      emp.email      ?? "",
      startDate:  emp.startDate  ? emp.startDate.slice(0, 10) : "",
      status:     emp.status     ?? "ATIVO",
      notes:      emp.notes      ?? "",
    });
    setEditingId(emp.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.role.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      companyId,
      startDate: form.startDate || null,
    };
    const url    = editingId ? `/api/employees/${editingId}` : "/api/employees";
    const method = editingId ? "PATCH" : "POST";
    const res    = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowForm(false);
      setEditingId(null);
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover colaborador? Esta acção não pode ser desfeita.")) return;
    setDeleting(id);
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    setDeleting(null);
    await load();
  }

  const active   = employees.filter(e => e.status === "ATIVO");
  const inactive = employees.filter(e => e.status !== "ATIVO");

  return (
    <section className="rounded-xl border border-white/10 bg-white/3 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-paper">Colaboradores</h2>
          <p className="text-xs text-mist mt-0.5">
            {active.length} ativo(s) · {inactive.length} inativo(s)
          </p>
        </div>
        <button
          onClick={startCreate}
          className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-medium text-white hover:bg-azul-dim"
        >
          + Adicionar
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-5 rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-paper">
            {editingId ? "Editar colaborador" : "Novo colaborador"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-mist mb-1">Nome *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-xs text-mist mb-1">Cargo *</label>
              <input
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
                placeholder="Ex: Designer, Developer…"
              />
            </div>
            <div>
              <label className="block text-xs text-mist mb-1">Departamento</label>
              <input
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
                placeholder="Ex: Tecnologia"
              />
            </div>
            <div>
              <label className="block text-xs text-mist mb-1">Telefone</label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
                placeholder="+244 9xx xxx xxx"
              />
            </div>
            <div>
              <label className="block text-xs text-mist mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
                placeholder="email@empresa.com"
              />
            </div>
            <div>
              <label className="block text-xs text-mist mb-1">Data de entrada</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
              />
            </div>
            <div>
              <label className="block text-xs text-mist mb-1">Estado</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full focus-ring h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-paper"
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="AFASTADO">Afastado</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-mist mb-1">Notas</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full focus-ring rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-paper resize-none"
                placeholder="Observações opcionais…"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:text-paper hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.role.trim()}
              className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-medium text-white hover:bg-azul-dim disabled:opacity-50"
            >
              {saving ? "A guardar…" : editingId ? "Guardar alterações" : "Adicionar colaborador"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-mist py-4 text-center">A carregar…</p>
      ) : employees.length === 0 ? (
        <p className="text-sm text-mist py-4 text-center">
          Ainda não há colaboradores registados para esta empresa.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-mist uppercase tracking-wider text-left">
                <th className="pb-2 pr-4">Nome</th>
                <th className="pb-2 pr-4">Cargo</th>
                <th className="pb-2 pr-4">Departamento</th>
                <th className="pb-2 pr-4">Contacto</th>
                <th className="pb-2 pr-4">Estado</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-white/3 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-paper">{emp.name}</td>
                  <td className="py-2.5 pr-4 text-mist">{emp.role}</td>
                  <td className="py-2.5 pr-4 text-mist">{emp.department || "—"}</td>
                  <td className="py-2.5 pr-4 text-mist text-xs">
                    {emp.phone && <div>{emp.phone}</div>}
                    {emp.email && <div>{emp.email}</div>}
                    {!emp.phone && !emp.email && "—"}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[emp.status] ?? "bg-zinc-500/15 text-zinc-400"}`}>
                      {STATUS_LABELS[emp.status] ?? emp.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => startEdit(emp)}
                      className="text-xs text-mist hover:text-paper mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(emp.id)}
                      disabled={deleting === emp.id}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      {deleting === emp.id ? "…" : "Remover"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
