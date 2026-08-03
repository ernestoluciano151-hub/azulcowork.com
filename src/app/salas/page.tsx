import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import SalaBookingForm from "@/components/SalaBookingForm";

const PLANS = [
  {
    name: "Plano Alpha",
    slug: "Alpha",
    capacity: 24,
    badge: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    highlight: false,
    desc: "Ideal para grandes formações, workshops e eventos corporativos.",
  },
  {
    name: "Plano Beta",
    slug: "Beta",
    capacity: 15,
    badge: "bg-purple-500/10 border-purple-500/30 text-purple-300",
    highlight: false,
    desc: "Perfeito para reuniões de equipa alargadas e sessões de treino.",
  },
  {
    name: "Plano Gamma",
    slug: "Gamma",
    capacity: 8,
    badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    highlight: true,
    desc: "A escolha mais popular para reuniões de trabalho e brainstormings.",
  },
  {
    name: "Plano Easy",
    slug: "Easy",
    capacity: 4,
    badge: "bg-teal-500/10 border-teal-500/30 text-teal-300",
    highlight: false,
    desc: "Reuniões rápidas, entrevistas e chamadas de vídeo em privado.",
  },
  {
    name: "Plano Personalizado",
    slug: "Personalizado",
    capacity: 0,
    badge: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    highlight: false,
    desc: "Para eventos e formações superiores a 16 horas. Orçamento sob medida.",
    custom: true,
  },
];

const INCLUDES = [
  { icon: "❄️", label: "Sala climatizada" },
  { icon: "📽️", label: "Projetor para apresentações" },
  { icon: "📺", label: "Televisão de grande ecrã" },
  { icon: "⚡", label: "Internet de alta velocidade" },
  { icon: "🖨️", label: "Impressões limitadas" },
  { icon: "☕", label: "Coffee Break opcional" },
  { icon: "🔇", label: "Ambiente privado e silencioso" },
  { icon: "🅿️", label: "Estacionamento próximo" },
];

const GALLERY = [
  "/assets/reuniao-1.jpeg",
  "/assets/reuniao-2.jpeg",
  "/assets/reuniao-3.jpeg",
  "/assets/reuniao-4.jpeg",
];

export default function SalasPage() {
  return (
    <main className="min-h-screen bg-ink">
      <Navbar />

      {/* Hero da página */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/assets/reuniao-1.jpeg"
            alt="Sala de Reunião Azul Coworking"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-ink/80" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 md:px-8 text-center">
          <span className="inline-block text-azul font-semibold text-sm uppercase tracking-widest mb-4">
            Sala de Reunião & Formação
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-paper leading-tight">
            O espaço certo para as suas <span className="text-azul">melhores decisões</span>
          </h1>
          <p className="text-mist text-lg md:text-xl mt-6 max-w-2xl mx-auto">
            Uma sala totalmente equipada, climatizada e silenciosa — disponível por horas ou dias, com planos para 4 a 24 pessoas.
          </p>
          <a
            href="#reservar"
            className="inline-flex items-center gap-2 mt-8 bg-azul text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-azul-dim transition-all shadow-glow"
          >
            Reservar agora →
          </a>
        </div>
      </section>

      {/* Vídeo de apresentação */}
      <section className="py-12 md:py-16 bg-ink">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <div className="text-center mb-8">
            <span className="text-azul font-semibold text-sm uppercase tracking-widest">Conheça o Espaço</span>
            <h2 className="font-display text-2xl md:text-4xl font-bold text-paper mt-3">
              Veja as nossas salas por dentro
            </h2>
          </div>
          <div className="relative w-full overflow-hidden rounded-2xl border border-white/10" style={{ paddingTop: "56.25%" }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src="https://www.youtube.com/embed/s0d7qDC7mck?si=YM1UJ7bIS9mVKNpy&controls=0"
              title="Azul Coworking — Salas de Reunião"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* O que está incluído */}
      <section className="py-16 md:py-20 bg-ink2">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center mb-12">
            <span className="text-azul font-semibold text-sm uppercase tracking-widest">Equipamentos & Serviços</span>
            <h2 className="font-display text-2xl md:text-4xl font-bold text-paper mt-3">
              Tudo incluído na reserva
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {INCLUDES.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-white/10 bg-white/[0.03] text-center"
              >
                <span className="text-3xl">{item.icon}</span>
                <span className="text-paper text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Galeria de imagens */}
      <section className="py-12 bg-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {GALLERY.map((src, i) => (
              <div key={src} className={`relative overflow-hidden rounded-2xl ${i === 0 ? "col-span-2 row-span-2 md:h-72" : "h-36 md:h-36"}`}>
                <img
                  src={src}
                  alt={`Sala de reunião ${i + 1}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section className="py-16 md:py-24 bg-ink2">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center mb-12">
            <span className="text-azul font-semibold text-sm uppercase tracking-widest">Planos disponíveis</span>
            <h2 className="font-display text-2xl md:text-4xl font-bold text-paper mt-3">
              Uma sala, <span className="text-azul">cinco planos</span>
            </h2>
            <p className="text-mist mt-4 max-w-xl mx-auto">
              Escolha o plano que melhor se adapta ao tamanho do seu grupo e às suas necessidades.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-2xl border p-7 flex flex-col gap-4 transition-all ${
                  p.highlight
                    ? "border-azul/40 bg-azul/5 shadow-glow"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-azul text-white text-xs font-bold px-4 py-1 rounded-full">
                    Mais popular
                  </span>
                )}
                <div className={`inline-block self-start rounded-full px-3 py-1 text-xs font-bold border ${p.badge}`}>
                  {p.name}
                </div>
                <div>
                  <div className="font-display text-3xl font-bold text-paper">
                    {p.custom ? "Negociável" : `Até ${p.capacity} pessoas`}
                  </div>
                  <div className="text-mist text-xs mt-1">
                    {p.custom ? "Orçamento personalizado" : "Capacidade máxima"}
                  </div>
                </div>
                <p className="text-mist text-sm flex-1">{p.desc}</p>
                <a
                  href={`#reservar`}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    p.highlight
                      ? "bg-azul text-white hover:bg-azul-dim shadow-glow"
                      : "bg-white/5 text-paper hover:bg-white/10 border border-white/10"
                  }`}
                >
                  Reservar este plano →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coffee Break destaque */}
      <section className="py-12 bg-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-8 md:p-10 flex flex-col md:flex-row items-center gap-6">
            <div className="text-5xl shrink-0">☕</div>
            <div className="flex-1">
              <h3 className="font-display text-xl md:text-2xl font-bold text-paper">
                Adicione Coffee Break à sua reserva
              </h3>
              <p className="text-mist mt-2 text-sm md:text-base">
                Ofereça aos participantes um serviço de coffee break com café, chá, sumos e snacks. Disponível em todos os planos mediante pedido antecipado no formulário de reserva.
              </p>
            </div>
            <a
              href="#reservar"
              className="shrink-0 bg-amber-500/20 border border-amber-500/30 text-amber-300 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-amber-500/30 transition-colors whitespace-nowrap"
            >
              Incluir Coffee Break →
            </a>
          </div>
        </div>
      </section>

      {/* Formulário de reserva */}
      <section id="reservar" className="py-16 md:py-24 bg-ink2 scroll-mt-20">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <div className="text-center mb-10">
            <span className="text-azul font-semibold text-sm uppercase tracking-widest">Formulário de Reserva</span>
            <h2 className="font-display text-2xl md:text-4xl font-bold text-paper mt-3">
              Reserve a sua sala
            </h2>
            <p className="text-mist mt-4">
              Preencha os dados abaixo e entraremos em contacto para confirmar a disponibilidade.
            </p>
          </div>
          <Suspense fallback={<div className="text-center text-mist py-8">A carregar formulário...</div>}>
            <SalaBookingForm />
          </Suspense>
        </div>
      </section>

      {/* Footer simples */}
      <footer className="border-t border-white/10 bg-ink py-8">
        <div className="mx-auto max-w-7xl px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/">
            <img src="/assets/logo-azul.jpeg" alt="Azul Coworking" className="h-9 rounded-lg" />
          </a>
          <span className="text-mist text-sm">© {new Date().getFullYear()} Azul Coworking. Todos os direitos reservados.</span>
          <a href="/" className="text-azul hover:text-paper text-sm transition-colors">← Voltar ao início</a>
        </div>
      </footer>
    </main>
  );
}
