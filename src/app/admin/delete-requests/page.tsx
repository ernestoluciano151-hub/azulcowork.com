"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import { format } from "date-fns";

type DeleteRequest = {
  id: string;
  requestedBy: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  reason: string;
  status: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  lead: "Lead",
  company: "Empresa",
  payment: "Pagamento",
  reservation: "Reserva",
  roomLead: "Lead Sala",
};

export default function DeleteRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/delete-requests");
    if (res.status === 401) { router.push("/admin/login"); return; }
    if (res.ok) {
      const d = await res.json();
      setRequests(d.requests || []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function handleAction(id: string, action: "APPROVE" | "REJECT") {
    setActionId(id);
    await fetch(`/api/delete-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNote: rejectNote[id] || null }),
    });
    setActionId(null);
    fetchRequests();
  }

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-paper">Pedidos de Aprovação</h1>
          <p className="mt-1 text-sm text-mist">{requests.length} pedido(s) pendente(s) de eliminação.</p>
        </div>

        {loading && (
          <p className="text-mist text-sm">A carregar...</p>
        )}

        {!loading && requests.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-paper font-medium">Sem pedidos pendentes</p>
            <p className="text-sm text-mist mt-1">Todos os pedidos de eliminação foram processados.</p>
          </div>
        )}

        {!loading && requests.length > 0 && (
          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-full bg-azul/15 px-2.5 py-0.5 text-xs font-medium text-azul-glow">
                        {ENTITY_TYPE_LABELS[req.entityType] || req.entityType}
                      </span>
                      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                        PENDENTE
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-paper">{req.entityLabel}</h3>
                    <p className="mt-1 text-sm text-mist">
                      Pedido em {format(new Date(req.createdAt), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-ink p-4">
                  <p className="text-xs font-medium text-mist mb-1">Justificação:</p>
                  <p className="text-sm text-paper">{req.reason}</p>
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium text-mist">
                    Nota de rejeição (opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Motivo da rejeição..."
                    value={rejectNote[req.id] || ""}
                    onChange={(e) => setRejectNote((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper placeholder:text-mist/50 focus:outline-none focus:ring-2 focus:ring-azul"
                  />
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => handleAction(req.id, "APPROVE")}
                    disabled={actionId === req.id}
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {actionId === req.id ? "..." : "✅ Aprovar eliminação"}
                  </button>
                  <button
                    onClick={() => handleAction(req.id, "REJECT")}
                    disabled={actionId === req.id}
                    className="rounded-lg border border-white/10 px-5 py-2 text-sm font-medium text-paper hover:bg-white/5 disabled:opacity-50"
                  >
                    ❌ Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
