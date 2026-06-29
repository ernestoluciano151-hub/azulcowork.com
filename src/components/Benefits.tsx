const benefits = [
  { icon: "📶", title: "Internet de Alta Velocidade", desc: "Conexão fibra óptica estável e rápida" },
  { icon: "❄️", title: "Climatização", desc: "Ar condicionado em todos os espaços" },
  { icon: "🛡️", title: "Segurança 24h", desc: "Vigilância e controlo de acesso" },
  { icon: "☕", title: "Copa Equipada", desc: "Espaço de café e convívio" },
  { icon: "🖨️", title: "Impressora", desc: "Equipamento de impressão e scanner" },
  { icon: "⏰", title: "Horário Flexível", desc: "Acesso em horários adaptáveis" },
];

export default function Benefits() {
  return (
    <section id="vantagens" className="py-20 md:py-28 bg-ink2">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="text-center mb-16">
          <span className="text-azul font-semibold text-sm uppercase tracking-widest">Vantagens</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-paper mt-3">Tudo o que precisa, <span className="text-azul">incluído</span></h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map(b => (
            <div key={b.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:border-azul/30 transition-all">
              <div className="w-12 h-12 rounded-lg bg-azul/10 flex items-center justify-center mb-4 text-2xl">{b.icon}</div>
              <h3 className="font-display text-lg font-bold text-paper mb-1">{b.title}</h3>
              <p className="text-mist text-sm">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
