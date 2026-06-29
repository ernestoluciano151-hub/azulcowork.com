import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import VSL from "@/components/VSL";
import Gallery from "@/components/Gallery";
import Spaces from "@/components/Spaces";
import Benefits from "@/components/Benefits";
import MeetingPlans from "@/components/MeetingPlans";
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
            {[["200+","Clientes"],["3","Espaços"],["Luanda","Angola"],["2020","Fundação"]].map(([v,l]) => (
              <div key={l}><div className="font-display text-2xl md:text-3xl font-bold text-white">{v}</div><div className="text-white/70 text-sm mt-1">{l}</div></div>
            ))}
          </div>
        </div>
      </div>
      <VSL />
      <Gallery />
      <Spaces />
      <Benefits />
      <MeetingPlans />
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
            <div className="flex gap-6">
              {["#inicio","#espacos","#precos","#contacto"].map((h,i) => (
                <a key={h} href={h} className="text-mist hover:text-azul text-sm">{["Início","Espaços","Preços","Contacto"][i]}</a>
              ))}
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
