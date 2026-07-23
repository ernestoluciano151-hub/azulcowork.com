"use client";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface AdminLayoutProps {
  children: React.ReactNode;
  /** Optional extra className for the <main> element */
  className?: string;
}

/**
 * AdminLayout — wrapper reutilizável para todas as páginas admin.
 * Layout fixo: sidebar à esquerda, topbar no topo, conteúdo scroll independente.
 */
export default function AdminLayout({ children, className = "" }: AdminLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-ink">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className={`flex-1 overflow-y-auto p-8 ${className}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
