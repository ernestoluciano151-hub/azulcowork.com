const plans = [
  { name: "Hot Desk", price: "9.900", unit: "AOA/dia", popular: false, features: ["Mesas partilhadas", "Internet rápida", "Ambiente colaborativo", "Mínimo 3 dias", "Ou 79.900 AOA/mês"] },
  { name: "Mesa Fixa", price: "79.900", unit: "AOA/mês", popular: true, features: ["Lugar garantido", "Maior produtividade", "Comunidade ativa", "Internet rápida", "Café e chá incluídos"] },
  { name: "Sala Privada Pequena", price: "119.900", unit: "AOA/mês", popular: false, features: ["Até 4 pessoas", "Privacidade total", "Espaço dedicado", "Mínimo 3 meses", "Ambiente profissional"] },
  { name: "Sala Premium", price: "199.900", unit: "AOA/mês", popular: false, features: ["Mais silenciosa", "Maior conforto", "Experiência premium", "Ou 35.000 AOA/dia", "Mín. 3 dias (diária)"] },
  { name: "Sala Privada Grande", price: "299.900", unit: "AOA/mês", popular: false, features: ["Até 12 pessoas", "Espaço amplo", "Total privacidade", "Ideal para equipas", "Ambiente executivo"] },
  { name: "Escritório Digital", price: "19.900", unit: "AOA/mês", popular: false, features: ["Endereço comercial", "Receção de encomendas", "1 dia grátis/mês", "Sem espaço físico fixo", "Ideal para empresas remotas"] },
];

export default function Pricing() {
  return (
    <section id="precos" className="py-20 md:py-28 bg-ink">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="text-center mb-16">
          <span className="text-azul font-semibold text-sm uppercase tracking-widest">Preços</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-paper mt-3">Planos <span className="text-azul">acessíveis</span></h2>
          <p className="text-mist mt-4 max-w-lg mx-auto">Escolha o plano que melhor se adapta às suas necessidades.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map(p => (
            <div key={p.name} className={`relative rounded-2xl p-8 border transition-all duration-300 hover:-translate-y-1 ${p.popular ? "border-azul/40 bg-azul/5 shadow-glow" : "border-white/10 bg-white/[0.03]"}`}>
              {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-azul text-white text-xs font-bold px-4 py-1 rounded-full">Mais Popular</span>}
              <h3 className="font-display text-xl font-bold text-paper mb-2">{p.name}</h3>
              <div className="mb-6"><span className="text-4xl font-bold text-azul">{p.price}</span><span className="text-sm ml-1 text-mist"> {p.unit}</span></div>
              <ul className="space-y-3 mb-8">
                {p.features.map(f => <li key={f} className="flex items-center gap-3 text-sm text-mist"><span className="text-azul">✓</span>{f}</li>)}
              </ul>
              <a href="#formulario" className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${p.popular ? "bg-azul text-white hover:bg-azul-dim" : "border border-azul text-azul hover:bg-azul hover:text-white"}`}>
                Quero este Plano
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
