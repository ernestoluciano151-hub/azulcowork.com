import { Suspense } from "react";
import SalaBookingForm from "@/components/SalaBookingForm";

export default function SalasPage() {
  return (
    <main className="min-h-screen bg-ink">
      <nav className="bg-ink/95 backdrop-blur border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="/"><img src="/assets/logo-azul.jpeg" alt="Azul Coworking" className="h-10 rounded-lg" /></a>
          <a href="/" className="text-mist hover:text-paper text-sm">← Voltar ao início</a>
        </div>
      </nav>
      <div className="py-16 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-azul font-semibold text-sm uppercase tracking-widest">Sala de Reunião & Formação</span>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-paper mt-3">Reserve a sua sala</h1>
            <p className="text-mist mt-4 max-w-2xl mx-auto">Escolha o plano adequado e agende a sua reserva. Entraremos em contacto para confirmar.</p>
          </div>
          {/* Plans overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-16">
            {[
              {name:"Alpha",cap:24,color:"text-blue-300"},
              {name:"Beta",cap:15,color:"text-purple-300"},
              {name:"Gamma",cap:8,color:"text-emerald-300"},
              {name:"Easy",cap:4,color:"text-teal-300"},
              {name:"Personalizado",cap:0,color:"text-amber-300"},
            ].map(p => (
              <div key={p.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
                <div className={`font-display text-lg font-bold ${p.color}`}>{p.name}</div>
                <div className="text-paper text-sm mt-1">{p.cap ? `Até ${p.cap} pessoas` : "≥ 16h personalizado"}</div>
              </div>
            ))}
          </div>
          <Suspense fallback={<div className="text-center text-mist py-8">A carregar...</div>}>
            <SalaBookingForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
