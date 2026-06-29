"use client";
import { useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // Links âncora para a página principal
  const homeLinks = [
    { href: "#espacos", label: "Espaços" },
    { href: "#vantagens", label: "Vantagens" },
    { href: "#precos", label: "Preços" },
    { href: "#contacto", label: "Contacto" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-ink/95 backdrop-blur-md border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a href="#inicio" className="flex items-center gap-2 shrink-0">
            <img src="/assets/logo-azul.jpeg" alt="Azul Coworking" className="h-10 md:h-12 rounded-lg" />
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {/* Página: Início */}
            <a href="#inicio" className="text-mist hover:text-paper transition-colors text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/5">
              Início
            </a>

            {homeLinks.map(l => (
              <a key={l.href} href={l.href} className="text-mist hover:text-paper transition-colors text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/5">
                {l.label}
              </a>
            ))}

            {/* Separador */}
            <div className="w-px h-5 bg-white/20 mx-2" />

            {/* Página: Sala de Reunião */}
            <a href="/salas" className="text-azul-glow hover:text-paper transition-colors text-sm font-semibold px-3 py-2 rounded-lg hover:bg-azul/10 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5z"/>
              </svg>
              Sala de Reunião
            </a>

            {/* CTA */}
            <a href="#formulario" className="ml-2 bg-azul text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-azul-dim transition-colors shadow-glow">
              Agendar Visita
            </a>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setOpen(o => !o)} className="md:hidden text-paper text-2xl w-10 h-10 flex items-center justify-center">
            {open ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-6 flex flex-col gap-1 border-t border-white/10 mt-1 pt-4">
            <a href="#inicio" onClick={() => setOpen(false)} className="text-mist hover:text-paper text-sm font-medium px-3 py-2.5 rounded-lg hover:bg-white/5">
              Início
            </a>
            {homeLinks.map(l => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-mist hover:text-paper text-sm font-medium px-3 py-2.5 rounded-lg hover:bg-white/5">
                {l.label}
              </a>
            ))}
            {/* Separador mobile */}
            <div className="h-px bg-white/10 my-2" />
            <a href="/salas" className="text-azul-glow text-sm font-semibold px-3 py-2.5 rounded-lg hover:bg-azul/10 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5z"/>
              </svg>
              Sala de Reunião & Formação
            </a>
            <div className="h-px bg-white/10 my-2" />
            <a href="#formulario" onClick={() => setOpen(false)} className="flex items-center justify-center bg-azul text-white px-5 py-3 rounded-lg font-semibold text-sm mt-1">
              Agendar Visita
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
