"use client";
import { useState, useEffect } from "react";

type SpaceProps = { title: string; description: string; price: string; images: string[]; cta: string; ctaHref: string; };

function SpaceCard({ title, description, price, images, cta, ctaHref }: SpaceProps) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCurrent(c => (c + 1) % images.length), 3500);
    return () => clearInterval(t);
  }, [images.length]);
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-azul/30 transition-all duration-300 hover:-translate-y-1">
      <div className="relative h-56 overflow-hidden">
        <div className="flex transition-transform duration-600 ease-in-out h-full" style={{ transform: `translateX(-${current * 100}%)` }}>
          {images.map((src, i) => (
            <div key={i} className="flex-none w-full h-full">
              <img src={src} alt={title} className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={`rounded-full transition-all ${i === current ? "w-6 h-1.5 bg-azul" : "w-1.5 h-1.5 bg-white/50"}`} />
          ))}
        </div>
      </div>
      <div className="p-6">
        <h3 className="font-display text-xl font-bold text-paper mb-2">{title}</h3>
        <p className="text-mist text-sm leading-relaxed mb-4">{description}</p>
        <div className="flex items-center justify-between">
          <span className="text-azul font-bold text-sm">{price}</span>
          <a href={ctaHref} className="text-azul hover:text-paper text-sm font-semibold transition-colors">{cta} →</a>
        </div>
      </div>
    </div>
  );
}

export default function Spaces() {
  const spaces = [
    { title: "Hot Desk / Open Space", description: "Mesas partilhadas em ambiente colaborativo, com internet rápida. Ideal para freelancers que precisam de flexibilidade diária.", price: "Desde 9.900 AOA/dia", images: ["/assets/openspace-1.jpeg","/assets/openspace-2.jpeg","/assets/openspace-3.jpeg"], cta: "Quero este Espaço", ctaHref: "#formulario" },
    { title: "Sala Privada", description: "Escritórios privados para equipas de 4 a 12 pessoas. Total privacidade, conforto e ambiente profissional dedicado.", price: "Desde 119.900 AOA/mês", images: ["/assets/privada-1.jpeg","/assets/privada-2.jpeg","/assets/privada-3.jpeg"], cta: "Quero este Espaço", ctaHref: "#formulario" },
    { title: "Sala de Reunião", description: "Sala executiva para até 24 pessoas, com projetor, internet de alta velocidade e ambiente profissional.", price: "15.000 AOA/hora (mín. 4h)", images: ["/assets/reuniao-1.jpeg","/assets/reuniao-2.jpeg","/assets/reuniao-3.jpeg","/assets/reuniao-4.jpeg"], cta: "Reservar Sala", ctaHref: "/salas" },
  ];
  return (
    <section id="espacos" className="py-20 md:py-28 bg-ink">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="text-center mb-16">
          <span className="text-azul font-semibold text-sm uppercase tracking-widest">Nossos Espaços</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-paper mt-3">Encontre o espaço <span className="text-azul">ideal</span></h2>
          <p className="text-mist mt-4 max-w-lg mx-auto">Escritórios modernos e totalmente equipados no coração de Luanda.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {spaces.map(s => <SpaceCard key={s.title} {...s} />)}
        </div>
      </div>
    </section>
  );
}
