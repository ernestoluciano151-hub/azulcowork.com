"use client";

import VSLVideo from "@/components/VSLVideo";

/**
 * Bloco de Vídeo de Vendas (VSL) da landing page principal.
 *
 * Player YouTube com autoplay (mudo) + CTA inteligente que surge aos 2:00
 * abaixo do vídeo, a substituir o antigo player Vturb nesta mesma posição.
 */
export default function VSL() {
  return (
    <section id="vsl" className="bg-ink2 py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-2xl font-bold text-paper md:text-4xl">
          Assista antes de agendar
        </h2>
        <p className="mt-3 text-mist">
          5 minutos para entender exatamente como vamos estruturar o seu plano de crescimento.
        </p>

        <div className="mt-10">
          <VSLVideo />
        </div>
      </div>
    </section>
  );
}
