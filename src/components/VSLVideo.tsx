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

interface YTPlayerInstance {
  getCurrentTime: () => number;
  unMute: () => void;
  mute: () => void;
  isMuted: () => boolean;
  playVideo: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: Record<string, unknown>
      ) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function VSLVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef     = useRef<YTPlayerInstance | null>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showCta, setShowCta] = useState(false);
  const [muted, setMuted]     = useState(true);
  // 02 Set 2026: a API do YouTube pode demorar vários segundos a ficar
  // pronta (ou precisar de uma tentativa extra — ver retry abaixo). Até lá,
  // o container ficava um rectângulo vazio sobre fundo escuro, indistinguível
  // de "não está a funcionar" — reportado directamente pelo PO. `playerReady`
  // controla uma imagem de capa (thumbnail real do YouTube) visível até o
  // iframe estar de facto montado, para nunca parecer quebrado enquanto carrega.
  const [playerReady, setPlayerReady] = useState(false);

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
          // 02 Set 2026: `autoplay:1` em playerVars nem sempre é suficiente
          // quando o player é criado via JS API (em vez de um embed estático
          // já presente no HTML) — comportamento inconsistente e conhecido
          // entre browsers. Forçar mute()+playVideo() aqui garante o
          // autoplay mesmo quando o parâmetro sozinho falha.
          onReady: (e: { target: YTPlayerInstance }) => {
            setPlayerReady(true);
            try {
              e.target.mute();
              e.target.playVideo();
            } catch { /* no-op — playerVars.autoplay ainda cobre este caso */ }
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

    // 02 Set 2026: se o script da IFrame API do YouTube falhar a carregar
    // (rede instável, bloqueio pontual externo, etc.), `window.YT` nunca
    // fica definido e o vídeo nunca aparece — sem qualquer nova tentativa.
    // Adicionado retry: se `window.YT.Player` não estiver pronto dentro de
    // 6s, remove o script preso e tenta novamente (até 2 vezes).
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function loadApiScript() {
      const existing = document.getElementById("youtube-iframe-api");
      if (existing) existing.remove();
      const tag = document.createElement("script");
      tag.id  = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = createPlayer;
    }

    function ensurePlayer() {
      if (window.YT && window.YT.Player) {
        createPlayer();
        return;
      }
      loadApiScript();
      retryTimer = setTimeout(() => {
        if (window.YT && window.YT.Player) return;
        attempts += 1;
        if (attempts <= 2) ensurePlayer();
      }, 6000);
    }

    ensurePlayer();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (retryTimer) clearTimeout(retryTimer);
    };
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
          className="relative w-full overflow-hidden rounded-xl bg-black"
          style={{ aspectRatio: "16 / 9" }}
        >
          {/* Capa (thumbnail real do YouTube) — visível até o player montar,
              para nunca parecer um espaço vazio/quebrado durante o carregamento */}
          {!playerReady && (
            <div
              aria-hidden
              className="absolute inset-0 h-full w-full animate-pulse bg-cover bg-center"
              style={{ backgroundImage: `url(https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg)` }}
            />
          )}

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
