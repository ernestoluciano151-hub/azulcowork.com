"use client";

import Script from "next/script";

/**
 * Bloco de Vídeo de Vendas (VSL) - integração com Vturb.
 *
 * Como ligar ao seu player Vturb:
 * 1. No painel do Vturb, copie o "Player ID" e o URL do script do player.
 * 2. Coloque-os no .env como NEXT_PUBLIC_VTURB_PLAYER_ID e NEXT_PUBLIC_VTURB_SCRIPT_URL.
 * 3. O Vturb normalmente fornece uma tag <vturb-smartplayer> + um <script>.
 *    Este componente já gera essa estrutura automaticamente a partir das envs.
 */
export default function VSL() {
  const playerId = process.env.NEXT_PUBLIC_VTURB_PLAYER_ID || "SEU-PLAYER-ID";
  const scriptUrl =
    process.env.NEXT_PUBLIC_VTURB_SCRIPT_URL ||
    "https://scripts.converteai.net/SEU-ACCOUNT/players/SEU-PLAYER/player.js";

  return (
    <section id="vsl" className="bg-ink2 py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-2xl font-bold text-paper md:text-4xl">
          Assista antes de agendar
        </h2>
        <p className="mt-3 text-mist">
          5 minutos para entender exatamente como vamos estruturar o seu plano de crescimento.
        </p>

        <div className="relative mt-10 rounded-2xl border border-white/10 bg-black/40 p-2 shadow-glow md:p-3">
          <div
            className="relative w-full overflow-hidden rounded-xl"
            style={{ aspectRatio: "16 / 9" }}
          >
            {/* Tag oficial do player Vturb (smartplayer) */}
            <vturb-smartplayer
              id={`vid-${playerId}`}
              style={{ display: "block", margin: "0 auto", width: "100%", height: "100%" }}
            ></vturb-smartplayer>
          </div>

          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-4 py-1 text-xs font-semibold text-ink">
            Em destaque
          </span>
        </div>

        <Script src={scriptUrl} strategy="lazyOnload" async />

        <div className="mt-8">
          <a
            href="#formulario"
            className="focus-ring inline-flex items-center justify-center rounded-xl bg-gold px-7 py-3.5 text-sm font-semibold text-ink transition hover:bg-gold-soft md:text-base"
          >
            Já vi, quero agendar agora
          </a>
        </div>
      </div>
    </section>
  );
}
