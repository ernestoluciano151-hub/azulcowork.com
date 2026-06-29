"use client";
import { useState, useEffect } from "react";

const images = [
  { src: "/assets/carousel-1.jpeg", alt: "Sala de Reunião/Formação" },
  { src: "/assets/carousel-2.jpeg", alt: "Sala Privada Executivo" },
  { src: "/assets/carousel-3.jpeg", alt: "Sala de Reunião" },
  { src: "/assets/carousel-4.jpeg", alt: "Ilha Open Space" },
  { src: "/assets/carousel-5.jpeg", alt: "Sala Privada" },
];

export default function Gallery() {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCurrent(c => (c + 1) % images.length), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="py-16 md:py-24 bg-ink2">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="text-center mb-10">
          <span className="text-azul font-semibold text-sm uppercase tracking-widest">Galeria</span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-paper mt-2">Os Nossos <span className="text-azul">Espaços</span></h2>
          <p className="text-mist mt-3 max-w-2xl mx-auto">Escritórios totalmente equipados, modernos e funcionais no Bairro Azul.</p>
        </div>
        <div className="relative max-w-5xl mx-auto rounded-2xl overflow-hidden">
          <div className="flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${current * 100}%)` }}>
            {images.map((img, i) => (
              <div key={i} className="flex-none w-full">
                <img src={img.src} alt={img.alt} className="w-full aspect-[16/9] object-cover" loading="lazy" />
              </div>
            ))}
          </div>
          <button onClick={() => setCurrent(c => (c - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-ink/80 hover:bg-ink text-paper rounded-full w-10 h-10 flex items-center justify-center text-lg border border-white/10">‹</button>
          <button onClick={() => setCurrent(c => (c + 1) % images.length)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-ink/80 hover:bg-ink text-paper rounded-full w-10 h-10 flex items-center justify-center text-lg border border-white/10">›</button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`rounded-full transition-all ${i === current ? "w-8 h-2 bg-azul" : "w-2 h-2 bg-white/40"}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
