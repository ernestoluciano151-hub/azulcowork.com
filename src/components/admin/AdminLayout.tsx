"use client";

import Sidebar from "./Sidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
  /** Optional extra className for the <main> element */
  className?: string;
}

/**
 * AdminLayout — wrapper reutilizável para todas as páginas admin.
 * Garante sidebar, fundo e responsividade consistentes em todo o sistema.
 */
export default function AdminLayout({ children, className = "" }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className={`flex-1 overflow-auto p-8 ${className}`}>
        {children}
      </main>
    </div>
  );
}
