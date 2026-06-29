"use client";
import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#inicio", label: "Início" },
    { href: "#espacos", label: "Espaços" },
    { href: "#vantagens", label: "Vantagens" },
    { href: "#salas", label: "Salas" },
    { href: "#precos", label: "Preços" },
    { href: "#contacto", label: "Contacto" },
  ];
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-ink/95 backdrop-blur-md border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <a href="#inicio" className="flex items-center gap-2">
            <img src="/assets/logo-azul.jpeg" alt="Azul Coworking" className="h-10 md:h-12 rounded-lg" />
          </a>
          <div className="hidden md:flex items-center gap-6">
            {links.map(l => (
              <a key={l.href} href={l.href} className="text-mist hover:text-paper transition-colors text-sm font-medium">{l.label}</a>
            ))}
            <a href="#formulario" className="bg-azul text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-azul-dim transition-colors shadow-glow">
              Agendar Visita
            </a>
          </div>
          <button onClick={() => setOpen(o => !o)} className="md:hidden text-paper text-2xl">
            {open ? "✕" : "☰"}
          </button>
        </div>
        {open && (
          <div className="md:hidden pb-6 flex flex-col gap-4">
            {links.map(l => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-mist hover:text-paper text-sm font-medium">{l.label}</a>
            ))}
            <a href="#formulario" onClick={() => setOpen(false)} className="flex items-center justify-center bg-azul text-white px-5 py-3 rounded-lg font-semibold text-sm">
              Agendar Visita
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
