import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import VSL from "@/components/VSL";
import Gallery from "@/components/Gallery";
import Spaces from "@/components/Spaces";
import Benefits from "@/components/Benefits";
import Pricing from "@/components/Pricing";
import LeadForm from "@/components/LeadForm";
import Contact from "@/components/Contact";

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <Hero />
      {/* Stats bar */}
      <div className="bg-azul py-8">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[["10+","Clientes"],["3","Espaços"],["Luanda","Angola"],["2026","Fundação"]].map(([v,l]) => (
              <div key={l}><div className="font-display text-2xl md:text-3xl font-bold text-white">{v}</div><div className="text-white/70 text-sm mt-1">{l}</div></div>
            ))}
          </div>
        </div>
      </div>
      <VSL />
      <Gallery />
      <Spaces />
      <Benefits />
      {/* CTA Sala de Reunião */}
      <section id="salas" className="py-16 md:py-20 bg-ink2">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="rounded-3xl border border-azul/20 bg-azul/5 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="md:max-w-lg">
              <span className="text-azul font-semibold text-sm uppercase tracking-widest">Sala de Reunião & Formação</span>
              <h2 className="font-display text-2xl md:text-4xl font-bold text-paper mt-3">
                Precisa de um espaço para a sua equipa?
              </h2>
              <p className="text-mist mt-4 text-base">
                Uma sala totalmente equipada para reuniões, formações e eventos. Planos para 4 a 24 pessoas, com opção de coffee break.
              </p>
              <ul className="mt-4 flex flex-wrap gap-3">
                {["Até 24 pessoas","Projetor & TV","Coffee Break","Wi-Fi Dedicado","Ar Condicionado"].map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-sm text-mist">
                    <span className="text-azul">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
            <a
              href="/salas"
              className="shrink-0 inline-flex items-center gap-2 bg-azul text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-azul-dim transition-all shadow-glow whitespace-nowrap"
            >
              Ver planos e reservar →
            </a>
          </div>
        </div>
      </section>
      <Pricing />
      <LeadForm />
      <Contact />
      <footer className="border-t border-white/10 bg-ink py-10">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/assets/logo-azul.jpeg" alt="Azul Coworking" className="h-10 rounded-lg" />
              <span className="text-mist text-sm">© {new Date().getFullYear()} Azul Coworking. Todos os direitos reservados.</span>
            </div>
            <div className="flex flex-wrap gap-6">
              {["#inicio","#espacos","#precos","#contacto"].map((h,i) => (
                <a key={h} href={h} className="text-mist hover:text-azul text-sm">{["Início","Espaços","Preços","Contacto"][i]}</a>
              ))}
              <a href="/salas" className="text-azul hover:text-paper text-sm font-medium">Sala de Reunião</a>
            </div>
          </div>
          <div className="mt-6 text-center">
            <span className="text-mist/40 text-xs">Desenvolvido por <a href="https://versaodigitallda.com" target="_blank" rel="noopener" className="text-mist/60 font-semibold hover:text-azul">VERSÃO DIGITAL</a></span>
          </div>
        </div>
      </footer>
    </main>
  );
}
