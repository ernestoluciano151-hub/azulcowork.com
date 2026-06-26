export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink bg-mesh pt-28 pb-16 md:pt-36 md:pb-24">
      <div className="absolute inset-0 -z-10 opacity-40" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-azul/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-gold-soft">
          Sessão estratégica gratuita
        </span>

        <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] text-paper md:text-6xl">
          Pare de adivinhar.{" "}
          <span className="bg-gradient-to-r from-azul-glow to-gold-soft bg-clip-text text-transparent">
            Construa um negócio com plano e números.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-mist md:text-lg">
          Em 15 minutos de vídeo, mostramos o método que estamos a usar para estruturar
          marketing, operação e crescimento de negócios em Angola — sem achismo, com dados.
          Veja o vídeo e agende a sua sessão estratégica gratuita.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#formulario"
            className="focus-ring inline-flex items-center justify-center rounded-xl bg-azul px-7 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-azul-dim md:text-base"
          >
            Quero agendar a minha sessão
          </a>
          <a
            href="#vsl"
            className="focus-ring inline-flex items-center justify-center rounded-xl border border-white/15 px-7 py-3.5 text-sm font-semibold text-paper transition hover:bg-white/5 md:text-base"
          >
            Ver o vídeo primeiro
          </a>
        </div>

        <p className="mt-4 text-xs text-mist">Sem compromisso · Vagas limitadas esta semana</p>
      </div>
    </section>
  );
}
