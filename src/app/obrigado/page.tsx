export default function ObrigadoPage() {
  return (
    <main className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10">
          <div className="text-6xl mb-6">🎉</div>
          <img src="/assets/logo-azul.jpeg" alt="Azul Coworking" className="h-12 rounded-lg mx-auto mb-6" />
          <h1 className="font-display text-3xl font-bold text-paper mb-4">Obrigado pelo seu interesse!</h1>
          <p className="text-mist text-lg mb-2">Recebemos o seu pedido com sucesso.</p>
          <p className="text-mist text-sm mb-8">A nossa equipa irá entrar em contacto consigo em breve pelo WhatsApp para confirmar os detalhes.</p>
          <div className="flex justify-center">
            <a href="/" className="inline-flex items-center justify-center gap-2 bg-azul text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-azul-dim transition-all">
              ← Voltar ao início
            </a>
          </div>
        </div>
        <p className="text-mist/40 text-xs mt-6">© {new Date().getFullYear()} Azul Coworking — Bairro Azul, Edifício 18, Luanda</p>
      </div>
    </main>
  );
}
