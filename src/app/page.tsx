import Hero from "@/components/Hero";
import VSL from "@/components/VSL";
import LeadForm from "@/components/LeadForm";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <VSL />
      <LeadForm />

      <footer className="border-t border-white/5 bg-ink py-8 text-center text-xs text-mist">
        © {new Date().getFullYear()} {process.env.NEXT_PUBLIC_SITE_NAME || "Versão Digital"}. Todos os
        direitos reservados.
      </footer>
    </main>
  );
}
