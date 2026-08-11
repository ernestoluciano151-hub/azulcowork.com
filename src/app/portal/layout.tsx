import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Portal do Cliente — Azul Coworking",
  description: "Aceda às suas faturas, contratos, reservas e suporte.",
};

export default function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 11 Ago 2026: classe "portal-light" activa o reset de cor em
  // src/styles/globals.css — o Portal do Cliente usa cartões de fundo claro
  // (bg-white), mas o <body> global define color:#F5F7FA (quase branco) para
  // o tema escuro do admin. Inputs/textareas/selects herdam essa cor via
  // color:inherit (Tailwind preflight), ficando invisíveis (texto branco em
  // fundo branco) em todo o Portal — reportado pelo PO com screenshot do
  // campo de email no login. Sem afectar o tema do admin (que precisa do
  // texto claro sobre fundo escuro).
  return <div className="portal-light">{children}</div>;
}
