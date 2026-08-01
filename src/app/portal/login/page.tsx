"use client";

/**
 * /portal/login — Página de autenticação do Portal do Cliente (VOL09)
 *
 * Suporta dois modos:
 * 1. Magic Link (padrão) — solicitar link por email
 * 2. Password — para utilizadores com passwordHash definido
 *
 * Após magic link, a página /api/portal/auth/magic redireciona
 * automaticamente para /portal/dashboard.
 */

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Mensagens de erro mapeadas do parâmetro ?error=
const ERROR_MESSAGES: Record<string, string> = {
  invalid_token:   "Link de acesso inválido. Por favor solicite um novo.",
  expired_token:   "Link de acesso expirado. Por favor solicite um novo.",
  used_token:      "Este link já foi utilizado. Por favor solicite um novo.",
  account_inactive:"Conta desactivada. Contacte o Azul Coworking.",
  unknown_error:   "Ocorreu um erro. Por favor tente novamente.",
  server_error:    "Erro interno do servidor. Por favor tente mais tarde.",
};

function PortalLoginInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode]       = useState<"magic" | "password">("magic");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mostrar erro de redirecionamento (ex: link inválido)
  useEffect(() => {
    const errParam = searchParams.get("error");
    if (errParam) {
      setError(ERROR_MESSAGES[errParam] ?? ERROR_MESSAGES.unknown_error);
    }
  }, [searchParams]);

  // ── Magic Link ─────────────────────────────────────────────────────────────
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/portal/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (res.status === 429) {
        setError(json.error ?? "Demasiados pedidos. Aguarde alguns minutos.");
        return;
      }
      if (!res.ok) {
        setError(json.error ?? "Erro ao enviar link. Tente novamente.");
        return;
      }
      setSent(true);
    } catch {
      setError("Sem ligação ao servidor. Verifique a sua internet.");
    } finally {
      setLoading(false);
    }
  }

  // ── Password ───────────────────────────────────────────────────────────────
  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (res.status === 429) {
        setError("Demasiadas tentativas. Aguarde 15 minutos.");
        return;
      }
      if (!res.ok) {
        setError(json.error ?? "Email ou password incorrectos.");
        return;
      }
      setSuccess("Login efectuado. A redirecionar...");
      router.push("/portal/dashboard");
    } catch {
      setError("Sem ligação ao servidor. Verifique a sua internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo + Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg">
            AZ
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Portal do Cliente</h1>
          <p className="text-gray-500 mt-1 text-sm">Azul Coworking · Bairro Azul, Luanda</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {/* Tab selector */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => { setMode("magic"); setError(null); setSent(false); }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                mode === "magic"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              📧 Link de Acesso
            </button>
            <button
              onClick={() => { setMode("password"); setError(null); setSent(false); }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                mode === "password"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              🔒 Password
            </button>
          </div>

          {/* Erro */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Sucesso */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
              {success}
            </div>
          )}

          {/* Magic Link enviado */}
          {sent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">📬</div>
              <h2 className="font-semibold text-gray-900 mb-2">Link enviado!</h2>
              <p className="text-sm text-gray-500 mb-4">
                Se o email <strong>{email}</strong> estiver registado, receberá
                um link de acesso em breve. Verifique também a pasta de spam.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Usar outro email
              </button>
            </div>
          ) : mode === "magic" ? (
            /* Formulário Magic Link */
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="o-seu-email@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "A enviar..." : "Enviar link de acesso"}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Receberá um link válido por 15 minutos no seu email.
              </p>
            </form>
          ) : (
            /* Formulário Password */
            <form onSubmit={handlePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="o-seu-email@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "A entrar..." : "Entrar"}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Problemas de acesso?{" "}
          <a href="mailto:geral@azulcowork.com" className="text-blue-500 hover:underline">
            Contacte-nos
          </a>
          {" · "}976 467 124
        </p>
      </div>
    </div>
  );
}

// useSearchParams() exige Suspense boundary no prerender (Next 15)
export default function PortalLoginPage() {
  return (
    <Suspense fallback={null}>
      <PortalLoginInner />
    </Suspense>
  );
}
