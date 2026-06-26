import Link from "next/link";

export const metadata = {
  title: "Obrigado pelo seu interesse!",
  robots: { index: false, follow: false }
};

export default function ObrigadoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink bg-mesh px-6 py-20">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center shadow-glow">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-azul/15 text-3xl">
          ✅
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold text-paper md:text-3xl">
          Obrigado pelo seu interesse!
        </h1>

        <p className="mt-4 text-mist">
          Recebemos as suas informações com sucesso. Entraremos em contacto consigo o mais breve
          possível, pelo WhatsApp indicado, para confirmar o seu agendamento.
        </p>

        <p className="mt-2 text-sm text-mist">
          Enquanto isso, fique atento ao seu telefone — a nossa equipa entra em contacto em breve.
        </p>

        <Link
          href="/"
          className="focus-ring mt-8 inline-flex items-center justify-center rounded-xl bg-azul px-6 py-3 text-sm font-semibold text-white transition hover:bg-azul-dim"
        >
          Voltar ao site principal
        </Link>
      </div>
    </main>
  );
}
