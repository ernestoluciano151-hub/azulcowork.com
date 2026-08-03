"use client";

/**
 * VSLVideo — vídeo de vendas (VSL) da landing page principal, na posição
 * anteriormente ocupada pelo player Vturb.
 *
 * - Autoplay ao carregar a página (mudo — exigência dos browsers para autoplay)
 * - Botão de som para o visitante activar áudio quando quiser
 * - CTA inteligente: aparece aos 2:00 do vídeo, ABAIXO do player, e leva
 *   directamente ao formulário de captação (#formulario), com scroll suave
 *
 * Usa a YouTube IFrame API (via postMessage) para observar o tempo de
 * reprodução — não requer nenhuma dependência externa.
 */

import { useEffect, useRef, useState } from "react";

const VIDEO_ID = "Sx9iC6HRKdE";
const CTA_AT_SECONDS = 120;

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: Record<string, unknown>
      ) => {
        getCurrentTime: () => number;
        unMute: () => void;
        mute: () => void;
        isMuted: () => boolean;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function VSLVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef     = useRef<ReturnType<NonNullable<Window["YT"]>["Player"]> | null>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showCta, setShowCta] = useState(false);
  const [muted, setMuted]     = useState(true);

  useEffect(() => {
    function createPlayer() {
      if (!containerRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: VIDEO_ID,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            pollRef.current = setInterval(() => {
              const t = playerRef.current?.getCurrentTime?.() ?? 0;
              if (t >= CTA_AT_SECONDS) {
                setShowCta(true);
                if (pollRef.current) clearInterval(pollRef.current);
              }
            }, 1000);
          },
        },
      });
    }

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else if (!document.getElementById("youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id  = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = createPlayer;
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function toggleSound() {
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted()) { p.unMute(); setMuted(false); }
    else { p.mute(); setMuted(true); }
  }

  function goToForm() {
    document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <div className="relative rounded-2xl border border-white/10 bg-black/40 p-2 shadow-glow md:p-3">
        <div
          className="relative w-full overflow-hidden rounded-xl"
          style={{ aspectRatio: "16 / 9" }}
        >
          <div ref={containerRef} className="absolute inset-0 h-full w-full" />

          {/* Botão de som (autoplay começa mudo por exigência dos browsers) */}
          <button
            onClick={toggleSound}
            className="absolute bottom-4 right-4 z-10 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-3 py-2 backdrop-blur transition"
          >
            {muted ? "🔇 Activar som" : "🔊 Som activo"}
          </button>
        </div>

        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-4 py-1 text-xs font-semibold text-ink">
          Em destaque
        </span>
      </div>

      {/* CTA inteligente — aparece aos 2:00, abaixo do vídeo */}
      {showCta && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button
            onClick={goToForm}
            className="focus-ring inline-flex items-center justify-center rounded-xl bg-gold px-7 py-3.5 text-sm font-semibold text-ink shadow-glow transition hover:bg-gold-soft md:text-base"
          >
            Já vi, quero agendar agora
          </button>
        </div>
      )}
    </div>
  );
}
