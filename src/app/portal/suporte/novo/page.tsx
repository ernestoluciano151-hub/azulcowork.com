"use client";

/**
 * /portal/suporte/novo — Abrir novo ticket de suporte (VOL09)
 *
 * Consome: POST /api/portal/support/tickets
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/portal/PortalLayout";
import Link from "next/link";

const CATEGORIES = [
  "Faturação",
  "Acesso e Segurança",
  "Reservas",
  "Contrato",
  "Instalações",
  "Internet e Tecnologia",
  "Limpeza e Manutenção",
  "Outro",
];

const PRIORITIES = [
  { value: "LOW",    label: "Baixa — questão não urgente" },
  { value: "NORMAL", label: "Normal — necessita de resposta em 24h" },
  { value: "HIGH",   label: "Alta — afecta o trabalho hoje" },
  { value: "URGENT", label: "Urgente — bloqueador imediato" },
];

function NovoTicketContent() {
  const router = useRouter();
  const [subject,  setSubject]  = useState("");
  const [body,     setBody]     = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState("NORMAL");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject.trim() || !body.trim()) {
      setError("Por favor preencha o assunto e a descrição do problema.");
      return;
    }
    setSubmitting(true);
    try {
      const res  = await fetch("/api/portal/support/tickets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ subject: subject.trim(), body: body.trim(), category, priority }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao abrir ticket. Tente novamente.");
        return;
      }
      router.push(`/portal/suporte/${json.data.id}`);
    } catch {
      setError("Sem ligação ao servidor. Verifique a sua internet.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/portal/suporte" className="text-sm text-gray-400 hover:text-gray-600">
          ← Suporte
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Novo Ticket de Suporte</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Assunto */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Assunto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={200}
              placeholder="Descreva brevemente o seu problema"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Descrição detalhada <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={5}
              placeholder="Explique o problema em detalhe: quando acontece, o que tentou, etc."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>
        </div>

        {/* Categoria e Prioridade */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Prioridade</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "A enviar..." : "Submeter Ticket"}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Respondemos em 24 horas (dias úteis). Para urgências: 976 467 124.
        </p>
      </form>
    </div>
  );
}

export default function PortalNovoTicketPage() {
  return (
    <PortalLayout>
      <NovoTicketContent />
    </PortalLayout>
  );
}
