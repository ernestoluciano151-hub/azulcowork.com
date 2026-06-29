export default function Contact() {
  return (
    <section id="contacto" className="py-20 md:py-28 bg-ink">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="text-center mb-16">
          <span className="text-azul font-semibold text-sm uppercase tracking-widest">Contacto</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-paper mt-3">
            Venha <span className="text-azul">conhecer-nos</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              icon: (
                <span className="text-2xl">📍</span>
              ),
              title: "Localização",
              content: (
                <>
                  <span>Bairro Azul, Edifício 18</span>
                  <br />
                  <span>Perto do Cine Tivoli — Luanda</span>
                </>
              ),
            },
            {
              icon: <span className="text-2xl">📞</span>,
              title: "Telefone",
              content: (
                <a href="tel:+244976467124" className="text-azul font-semibold text-lg hover:text-paper">
                  +244 976 467 124
                </a>
              ),
            },
            {
              icon: <span className="text-2xl">🕐</span>,
              title: "Horário",
              content: (
                <>
                  <span>Segunda a Sexta</span>
                  <br />
                  <span>08:00 — 18:00</span>
                </>
              ),
            },
          ].map((c) => (
            <div key={c.title} className="text-center p-6 rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="w-14 h-14 rounded-xl bg-azul/10 flex items-center justify-center mx-auto mb-4">
                {c.icon}
              </div>
              <h3 className="font-display text-lg font-bold text-paper mb-2">{c.title}</h3>
              <p className="text-mist text-sm">{c.content}</p>
            </div>
          ))}
        </div>

        {/* Social links */}
        <div className="flex justify-center gap-4 mt-10">
          {/* Instagram */}
          <a
            href="https://www.instagram.com/azulcoworking.ao"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="w-14 h-14 rounded-xl bg-azul/10 hover:bg-azul/20 flex items-center justify-center border border-white/10 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" className="stroke-paper" />
              <circle cx="12" cy="12" r="4" className="stroke-paper" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" className="text-paper" />
            </svg>
          </a>

          {/* Facebook */}
          <a
            href="https://www.facebook.com/share/1CacvhGJRR/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="w-14 h-14 rounded-xl bg-azul/10 hover:bg-azul/20 flex items-center justify-center border border-white/10 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" className="fill-paper" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
