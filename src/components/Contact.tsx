export default function Contact() {
  return (
    <section id="contacto" className="py-20 md:py-28 bg-ink">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="text-center mb-16">
          <span className="text-azul font-semibold text-sm uppercase tracking-widest">Contacto</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-paper mt-3">Venha <span className="text-azul">conhecer-nos</span></h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            { icon: "📍", title: "Localização", content: <><span>Bairro Azul, Edifício 18</span><br/><span>Perto do Cine Tivoli — Luanda</span></> },
            { icon: "📞", title: "Telefone", content: <a href="tel:+244976467124" className="text-azul font-semibold text-lg hover:text-paper">+244 976 467 124</a> },
            { icon: "🕐", title: "Horário", content: <><span>Segunda a Sexta</span><br/><span>08:00 — 18:00</span></> },
          ].map(c => (
            <div key={c.title} className="text-center p-6 rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="w-14 h-14 rounded-xl bg-azul/10 flex items-center justify-center mx-auto mb-4 text-2xl">{c.icon}</div>
              <h3 className="font-display text-lg font-bold text-paper mb-2">{c.title}</h3>
              <p className="text-mist text-sm">{c.content}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-4 mt-10">
          <a href="https://www.instagram.com/azulcoworking.ao" target="_blank" rel="noopener" className="w-14 h-14 rounded-xl bg-azul/10 hover:bg-azul/20 flex items-center justify-center text-paper text-xl border border-white/10">📷</a>
          <a href="https://www.facebook.com/share/1CacvhGJRR/" target="_blank" rel="noopener" className="w-14 h-14 rounded-xl bg-azul/10 hover:bg-azul/20 flex items-center justify-center text-paper font-bold border border-white/10">f</a>
        </div>
        <div className="text-center mt-12">
          <a href="https://wa.me/244976467124" target="_blank" rel="noopener" className="inline-flex items-center gap-3 bg-[#25D366] text-white px-8 py-4 rounded-xl font-bold text-base hover:opacity-90">
            💬 Falar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
