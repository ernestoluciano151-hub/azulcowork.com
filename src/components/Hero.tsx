export default function Hero() {
  return (
    <section id="inicio" className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <img src="/assets/hero-coworking.jpg" alt="Azul Coworking" className="w-full h-full object-cover" loading="eager" />
        <div className="absolute inset-0 bg-ink/75" />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 md:px-8 pt-24 pb-16 w-full">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-azul/10 border border-azul/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-azul">📍</span>
            <span className="text-azul text-sm font-medium">Bairro Azul, Edifício 18 — Luanda</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-paper leading-tight mb-6">
            O seu <span className="text-azul">espaço de trabalho</span> ideal.
          </h1>
          <p className="text-mist text-lg md:text-xl max-w-xl mb-4">
            Flexível, profissional e acessível. Coworking moderno em Luanda para freelancers, startups e empresas.
          </p>
          <p className="text-paper/80 text-base mb-8 font-medium">
            A partir de <span className="text-azul font-bold">9.900 AOA/dia</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="#formulario" className="inline-flex items-center justify-center gap-2 bg-azul text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-azul-dim transition-all shadow-glow">
              Agendar uma Visita →
            </a>
            <a href="#espacos" className="inline-flex items-center justify-center gap-2 border border-white/20 text-paper px-8 py-4 rounded-xl font-semibold text-base hover:bg-white/5 transition-all">
              Ver Espaços
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
