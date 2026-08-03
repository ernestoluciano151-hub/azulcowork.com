"use client";

/**
 * SalaVideoPlayer — vídeo de apresentação da página /salas
 *
 * - Autoplay ao carregar a página (mudo — exigência dos browsers para autoplay)
 * - Botão de som para o visitante activar áudio quando quiser
 * - CTA inteligente: aparece aos 0:50 do vídeo e leva directamente ao
 *   formulário de reserva (#reservar), com scroll suave
 *
 * Usa a YouTube IFrame API (via postMessage) para observar o tempo de
 * reprodução — não requer nenhuma dependência externa.
 */

import { useEffect, useRef, useState } from "react";

const VIDEO_ID = "s0d7qDC7mck";
const CTA_AT_SECONDS = 50;

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

export default function SalaVideoPlayer() {
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
    } else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
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
    document.getElementById("reservar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10" style={{ paddingTop: "56.25%" }}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {/* Botão de som (autoplay começa mudo por exigência dos browsers) */}
      <button
        onClick={toggleSound}
        className="absolute bottom-4 right-4 z-10 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-3 py-2 backdrop-blur transition"
      >
        {muted ? "🔇 Activar som" : "🔊 Som activo"}
      </button>

      {/* CTA inteligente — aparece aos 0:50 */}
      {showCta && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center pb-6 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button
            onClick={goToForm}
            className="rounded-full bg-azul hover:bg-azul/90 text-white text-sm md:text-base font-semibold px-6 py-3 shadow-xl shadow-black/30 transition"
          >
            📅 Reservar a minha sala agora
          </button>
        </div>
      )}
    </div>
  );
}
