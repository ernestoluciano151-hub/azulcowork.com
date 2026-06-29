import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import Script from "next/script";
import "@/styles/globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Azul Coworking — Espaços de trabalho em Luanda",
  description: "Coworking moderno em Luanda. Hot desks, salas privadas e salas de reunião. A partir de 9.900 AOA/dia. Bairro Azul, Edifício 18.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className={`${sora.variable} ${inter.variable} font-body antialiased`}>{children}</body>
      <Script id="fb-pixel" strategy="afterInteractive">{`
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init','991251830472277');fbq('init','3945584295744589');fbq('track','PageView');
`}</Script>
    </html>
  );
}
