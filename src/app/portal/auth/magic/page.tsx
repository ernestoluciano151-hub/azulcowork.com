"use client";

/**
 * /portal/auth/magic — Página de callback do Magic Link (VOL09)
 *
 * O magic link enviado por email aponta para:
 *   /api/portal/auth/magic?token=<token>
 *
 * Essa API route (VOL03) faz a validação, cria a sessão e redireciona
 * automaticamente para /portal/dashboard (ou /portal/login?error=...).
 *
 * Esta página serve como fallback visual para tokens inválidos/expirados
 * que chegam directamente aqui em vez da API route.
 */

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PortalMagicCallbackInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      router.replace("/portal/login?error=invalid_token");
      return;
    }

    // Redirecionar para a API route que valida o token
    window.location.href = `/api/portal/auth/magic?token=${encodeURIComponent(token)}`;
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-gray-900">A validar acesso...</h1>
        <p className="text-sm text-gray-500 mt-1">Aguarde um momento.</p>
      </div>
    </div>
  );
}

// useSearchParams() exige Suspense boundary no prerender (Next 15)
export default function PortalMagicCallbackPage() {
  return (
    <Suspense fallback={null}>
      <PortalMagicCallbackInner />
    </Suspense>
  );
}
