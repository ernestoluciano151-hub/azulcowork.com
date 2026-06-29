const PLANS = [
  { name: "Plano Alpha", capacity: 24, color: "bg-blue-500/10 border-blue-500/20 text-blue-300" },
  { name: "Plano Beta", capacity: 15, color: "bg-purple-500/10 border-purple-500/20 text-purple-300" },
  { name: "Plano Gamma", capacity: 8, color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" },
  { name: "Plano Easy", capacity: 4, color: "bg-teal-500/10 border-teal-500/20 text-teal-300" },
  { name: "Plano Personalizado", capacity: 24, color: "bg-amber-500/10 border-amber-500/20 text-amber-300", custom: true },
];

const INCLUDES = ["Sala climatizada", "Projetor para apresentações", "Internet de alta velocidade", "Impressões limitadas", "Coffee Break opcional"];

export default function MeetingPlans() {
  return (
    <section id="salas" className="py-20 md:py-28 bg-ink2">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="text-center mb-16">
          <span className="text-azul font-semibold text-sm uppercase tracking-widest">Sala de Reunião & Formação</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-paper mt-3">Uma sala, <span className="text-azul">cinco planos</span></h2>
          <p className="text-mist mt-4 max-w-2xl mx-auto">A nossa sala de reunião e formação está disponível em diferentes planos de capacidade. Equipada com tudo o que precisa para reuniões e formações profissionais.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 mb-12 rounded-2xl overflow-hidden border border-white/10">
          <div className="relative h-64 md:h-auto">
            <img src="/assets/reuniao-1.jpeg" alt="Sala de Reunião Azul Coworking" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-ink/40" />
          </div>
          <div className="p-8 bg-white/[0.03]">
            <h3 className="font-display text-xl font-bold text-paper mb-4">O que está incluído:</h3>
            <ul className="space-y-3">
              {INCLUDES.map(i => <li key={i} className="flex items-center gap-3 text-mist text-sm"><span className="text-azul font-bold">✓</span>{i}</li>)}
            </ul>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLANS.map(p => (
            <div key={p.name} className={`rounded-2xl border p-6 ${p.color.split(' ').slice(0,2).join(' ')}`}>
              <div className={`inline-block rounded-full px-3 py-1 text-xs font-bold mb-4 border ${p.color}`}>{p.name}</div>
              <div className="text-3xl font-bold text-paper mb-1">
                {p.custom ? "Negociável" : `Até ${p.capacity} pessoas`}
              </div>
              {p.custom && <p className="text-mist text-sm mb-4">Para eventos e formações superiores a 16 horas</p>}
              {!p.custom && <p className="text-mist text-sm mb-4">Capacidade máxima</p>}
              <a href={`/salas?plano=${p.name.replace("Plano ", "")}`} className="block text-center py-2.5 rounded-xl font-semibold text-sm bg-azul text-white hover:bg-azul-dim transition-colors">
                Reservar {p.name}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
