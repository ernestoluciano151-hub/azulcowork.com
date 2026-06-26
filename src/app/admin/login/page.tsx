"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Não foi possível entrar.");
        return;
      }
      router.push("/admin/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink bg-mesh px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8"
      >
        <h1 className="font-display text-xl font-bold text-paper">Área Administrativa</h1>
        <p className="mt-1 text-sm text-mist">Entre para gerir os leads.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paper">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink2 px-4 py-3 text-sm text-paper"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paper">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-ink2 px-4 py-3 text-sm text-paper"
              required
            />
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="focus-ring mt-6 w-full rounded-xl bg-azul px-6 py-3 text-sm font-semibold text-white transition hover:bg-azul-dim disabled:opacity-60"
        >
          {loading ? "A entrar..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
