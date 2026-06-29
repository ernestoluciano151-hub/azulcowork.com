"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  // Prefixo: se estiver na home usa âncora directa, caso contrário navega para a home primeiro
  const p = (anchor: string) => (isHome ? anchor : `/${anchor}`);

  const homeLinks = [
    { href: p("#inicio"),    label: "Início" },
    { href: p("#espacos"),   label: "Espaços" },
    { href: p("#vantagens"), label: "Vantagens" },
    { href: p("#precos"),    label: "Preços" },
    { href: p("#contacto"),  label: "Contacto" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-ink/95 backdrop-blur-md border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* Logo */}
          <a href={p("#inicio")} className="flex items-center gap-2 shrink-0">
            <img src="/assets/logo-azul.jpeg" alt="Azul Coworking" className="h-10 md:h-12 rounded-lg" />
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {homeLinks.map(l => (
              <a
                key={l.label}
                href={l.href}
                className="text-mist hover:text-paper transition-colors text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}

            {/* Separador */}
            <div className="w-px h-5 bg-white/20 mx-2" />

            {/* Link Sala de Reunião */}
            <a
              href="/salas"
              className={`transition-colors text-sm font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 ${
                pathname === "/salas"
                  ? "text-azul bg-azul/10"
                  : "text-azul-glow hover:text-paper hover:bg-azul/10"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
              </svg>
              Sala de Reunião
            </a>

            {/* CTA Agendar Visita → formulário de captação de lead */}
            <a
              href={p("#formulario")}
              className="ml-2 bg-azul text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-azul-dim transition-colors shadow-glow"
            >
              Agendar Visita
            </a>
          </div>

          {/* Botão menu mobile */}
          <button
            onClick={() => setOpen(o => !o)}
            className="md:hidden text-paper text-2xl w-10 h-10 flex items-center justify-center"
            aria-label="Abrir menu"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>

        {/* Menu mobile */}
        {open && (
          <div className="md:hidden pb-6 flex flex-col gap-1 border-t border-white/10 mt-1 pt-4">
            {homeLinks.map(l => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-mist hover:text-paper text-sm font-medium px-3 py-2.5 rounded-lg hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}

            <div className="h-px bg-white/10 my-2" />

            <a
              href="/salas"
              onClick={() => setOpen(false)}
              className="text-azul-glow text-sm font-semibold px-3 py-2.5 rounded-lg hover:bg-azul/10 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
              </svg>
              Sala de Reunião & Formação
            </a>

            <div className="h-px bg-white/10 my-2" />

            <a
              href={p("#formulario")}
              onClick={() => setOpen(false)}
              className="flex items-center justify-center bg-azul text-white px-5 py-3 rounded-lg font-semibold text-sm mt-1"
            >
              Agendar Visita
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
