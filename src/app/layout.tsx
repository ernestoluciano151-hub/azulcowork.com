import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "@/styles/globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600"] });

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Versão Digital";

export const metadata: Metadata = {
  title: `${siteName} | Agende a sua sessão estratégica`,
  description:
    "Descubra como estruturar o seu negócio para crescer com previsibilidade. Agende uma sessão estratégica gratuita e veja o plano feito para si.",
  openGraph: {
    title: `${siteName} | Agende a sua sessão estratégica`,
    description:
      "Descubra como estruturar o seu negócio para crescer com previsibilidade. Agende uma sessão estratégica gratuita.",
    type: "website",
    locale: "pt_PT"
  },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className={`${sora.variable} ${inter.variable} font-body antialiased`}>{children}</body>
    </html>
  );
}
