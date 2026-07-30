"use client";

/**
 * /admin/crm/tarefas — As Minhas Tarefas
 * Vista centralizada de tasks do utilizador autenticado.
 * ADMIN vê todas; COMERCIAL vê apenas as suas.
 * Consome: GET /api/crm/tasks/my
 */

import { useEffect, useState, useCallback } from "react";
import Link                                  from "next/link";
import AdminLayout                           from "@/components/admin/AdminLayout";
import type { CrmTask, TaskPriority, TaskStatus } from "@/types/crm";
import { TASK_PRIORITY_COLORS }              from "@/types/crm";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", URGENT: "Urgente",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pendente", IN_PROGRESS: "Em Curso", DONE: "Concluída", CANCELLED: "Cancelada",
};

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 text-5xl">✅</div>
      <h3 className="font-display text-lg font-semibold text-paper">Nenhuma tarefa pendente</h3>
      <p className="mt-2 text-sm text-mist">Estás em dia. As tarefas aparecem aqui quando forem atribuídas.</p>
    </div>
  );
}

// ── Card de Task ──────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onComplete,
  completing,
}: {
  task: CrmTask;
  onComplete: (id: string) => void;
  completing: string | null;
}) {
  const now     = Date.now();
  const overdue = task.dueDate && new Date(task.dueDate).getTime() < now && task.status !== "DONE";

  return (
    <div className={[
      "group flex items-start gap-4 rounded-2xl border p-4 transition",
      overdue
        ? "border-red-500/20 bg-red-500/[0.03]"
        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
    ].join(" ")}>
      {/* Checkbox */}
      <button
        onClick={() => onComplete(task.id)}
        disabled={completing === task.id || task.status === "DONE"}
        className={[
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
          task.status === "DONE"
            ? "border-emerald-500 bg-emerald-500/20"
            : "border-white/20 hover:border-azul hover:bg-azul/10",
          completing === task.id ? "opacity-50" : "",
        ].join(" ")}
        title={task.status === "DONE" ? "Concluída" : "Marcar como concluída"}
      >
        {task.status === "DONE" && <span className="text-[10px] text-emerald-400">✓</span>}
        {completing === task.id && <span className="h-3 w-3 animate-spin rounded-full border border-azul border-t-transparent" />}
      </button>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className={`text-sm font-medium ${task.status === "DONE" ? "line-through text-mist" : "text-paper"}`}>
            {task.title}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge label={PRIORITY_LABELS[task.priority as TaskPriority]} className={TASK_PRIORITY_COLORS[task.priority as TaskPriority]} />
            <Badge
              label={STATUS_LABELS[task.status as TaskStatus]}
              className={
                task.status === "DONE"           ? "bg-emerald-500/15 text-emerald-300" :
                task.status === "IN_PROGRESS"    ? "bg-blue-500/15 text-blue-300"       :
                task.status === "CANCELLED"      ? "bg-slate-500/15 text-slate-400"     :
                                                   "bg-white/10 text-mist"
              }
            />
          </div>
        </div>

        {task.description && (
          <p className="mt-1 text-xs text-mist line-clamp-2">{task.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
          {/* Empresa */}
          {task.company && (
            <Link href={`/admin/crm/${task.company.id}`} className="flex items-center gap-1 text-azul-glow hover:underline">
              🏗️ {task.company.name}
            </Link>
          )}

          {/* Prazo */}
          {task.dueDate && (
            <span className={overdue ? "font-semibold text-red-400" : "text-mist"}>
              {overdue ? "⚠ Vencida: " : "Prazo: "}
              {new Date(task.dueDate).toLocaleDateString("pt-AO")}
            </span>
          )}

          {/* Concluída em */}
          {task.completedAt && (
            <span className="text-mist">
              Concluída: {new Date(task.completedAt).toLocaleDateString("pt-AO")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type Filter = "all" | "overdue" | "today" | "pending" | "in_progress";

export default function MyTasksPage() {
  const [tasks, setTasks]       = useState<CrmTask[]>([]);
  const [meta, setMeta]         = useState<{ total: number; overdue: number } | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<Filter>("all");
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/tasks/my");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.data ?? []);
        setMeta(data.meta ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function handleComplete(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === "DONE" ? "PENDING" : "DONE";
    setCompleting(taskId);
    try {
      await fetch(`/api/crm/companies/${task.companyId}/tasks/${taskId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      await fetchTasks();
    } finally {
      setCompleting(null);
    }
  }

  // Filtrar tarefas localmente
  const now     = Date.now();
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const filtered = tasks.filter(t => {
    if (filter === "overdue")     return t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== "DONE";
    if (filter === "today")       return t.dueDate && new Date(t.dueDate) <= todayEnd && new Date(t.dueDate).getTime() >= new Date().setHours(0,0,0,0);
    if (filter === "pending")     return t.status === "PENDING";
    if (filter === "in_progress") return t.status === "IN_PROGRESS";
    return true;
  });

  // Agrupar: vencidas → hoje → restantes
  const overdueTasks = filtered.filter(t => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== "DONE");
  const todayTasks   = filtered.filter(t => t.dueDate && new Date(t.dueDate) <= todayEnd && new Date(t.dueDate).getTime() >= new Date().setHours(0,0,0,0));
  const otherTasks   = filtered.filter(t => !overdueTasks.includes(t) && !todayTasks.includes(t));

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper">As Minhas Tarefas</h1>
          <p className="mt-1 text-sm text-mist">
            {meta
              ? `${meta.total} tarefa${meta.total !== 1 ? "s" : ""} pendente${meta.total !== 1 ? "s" : ""}${meta.overdue > 0 ? ` · ⚠ ${meta.overdue} vencida${meta.overdue !== 1 ? "s" : ""}` : ""}`
              : "A carregar…"}
          </p>
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="mt-5 flex flex-wrap gap-2">
        {([
          ["all",         "Todas",         null],
          ["overdue",     "⚠ Vencidas",    meta?.overdue ?? 0],
          ["today",       "Hoje",          null],
          ["pending",     "Pendentes",     null],
          ["in_progress", "Em Curso",      null],
        ] as [Filter, string, number | null][]).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={[
              "rounded-lg border px-4 py-2 text-sm font-medium transition",
              filter === key
                ? "border-azul/40 bg-azul/15 text-azul-glow"
                : "border-white/10 text-mist hover:bg-white/5 hover:text-paper",
              key === "overdue" && (meta?.overdue ?? 0) > 0 ? "border-red-500/30" : "",
            ].join(" ")}
          >
            {label}
            {count !== null && count > 0 && (
              <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${key === "overdue" ? "bg-red-500 text-white" : "bg-white/15 text-mist"}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-azul border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-5 space-y-8">
          {/* Vencidas */}
          {overdueTasks.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Vencidas ({overdueTasks.length})
              </h2>
              <div className="space-y-3">
                {overdueTasks.map(t => (
                  <TaskCard key={t.id} task={t} onComplete={handleComplete} completing={completing} />
                ))}
              </div>
            </div>
          )}

          {/* Hoje */}
          {todayTasks.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Para hoje ({todayTasks.length})
              </h2>
              <div className="space-y-3">
                {todayTasks.map(t => (
                  <TaskCard key={t.id} task={t} onComplete={handleComplete} completing={completing} />
                ))}
              </div>
            </div>
          )}

          {/* Restantes */}
          {otherTasks.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist">
                <span className="h-2 w-2 rounded-full bg-mist" />
                Próximas ({otherTasks.length})
              </h2>
              <div className="space-y-3">
                {otherTasks.map(t => (
                  <TaskCard key={t.id} task={t} onComplete={handleComplete} completing={completing} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
