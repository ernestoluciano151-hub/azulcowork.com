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
  return <>{children}</>;
}
