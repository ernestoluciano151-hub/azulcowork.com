"use client";

/**
 * PortalLayout — Layout partilhado do Portal do Cliente (VOL09)
 *
 * Providencia contexto de autenticação portal e navegação lateral.
 * Usado por todas as páginas protegidas de /portal/*.
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PortalCompany {
  id:              string;
  name:            string;
  nif:             string | null;
  email:           string | null;
  contractStatus:  string;
  paymentStatus:   string;
}

interface PortalUser {
  id:          string;
  name:        string;
  email:       string;
  role:        string;
  phone:       string | null;
  notifyInApp: boolean;
  company:     PortalCompany;
}

interface PortalAuthCtx {
  user:    PortalUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout:  () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const PortalAuthContext = createContext<PortalAuthCtx>({
  user:    null,
  loading: true,
  refresh: async () => {},
  logout:  async () => {},
});

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}

// ── Nav links ─────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/portal/dashboard",  label: "Dashboard",    icon: "🏠" },
  { href: "/portal/faturas",    label: "Faturas",       icon: "📋" },
  { href: "/portal/pagamentos", label: "Pagamentos",    icon: "💳" },
  { href: "/portal/contratos",  label: "Contratos",     icon: "📄" },
  { href: "/portal/documentos", label: "Documentos",    icon: "📁" },
  { href: "/portal/reservas",   label: "Reservas",      icon: "🗓️" },
  { href: "/portal/suporte",    label: "Suporte",       icon: "💬" },
  { href: "/portal/empresa",    label: "A Minha Empresa", icon: "🏢" },
  { href: "/portal/perfil",     label: "Perfil",        icon: "👤" },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

function PortalSidebar({
  user,
  onLogout,
  isOpen,
  onClose,
}: {
  user:      PortalUser | null;
  onLogout:  () => void;
  isOpen:    boolean;
  onClose:   () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-40
          flex flex-col
          transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Logo / Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
              AZ
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 text-sm leading-tight truncate">
                Azul Coworking
              </div>
              <div className="text-xs text-gray-500 truncate">
                Portal do Cliente
              </div>
            </div>
          </div>
        </div>

        {/* Empresa */}
        {user && (
          <div className="px-4 py-3 border-b border-gray-100 bg-blue-50">
            <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
              Empresa
            </div>
            <div className="text-sm font-semibold text-gray-800 truncate">
              {user.company.name}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {user.role.replace("PORTAL_", "")}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href ||
              (link.href !== "/portal/dashboard" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm
                  transition-colors duration-100
                  ${isActive
                    ? "bg-blue-600 text-white font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }
                `}
              >
                <span className="text-base leading-none">{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Utilizador + Logout */}
        <div className="p-4 border-t border-gray-100">
          {user && (
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
              <div className="text-xs text-gray-500 truncate">{user.email}</div>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full text-left text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
          >
            🚪 Terminar Sessão
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Portal Layout ─────────────────────────────────────────────────────────────

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const [user,    setUser]    = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/auth/me");
      if (!res.ok) {
        router.replace("/portal/login");
        return;
      }
      const json = await res.json();
      setUser(json.data);
    } catch {
      router.replace("/portal/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/portal/auth/logout", { method: "POST" });
    } finally {
      router.replace("/portal/login");
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">A carregar portal...</p>
        </div>
      </div>
    );
  }

  return (
    <PortalAuthContext.Provider value={{ user, loading, refresh: fetchMe, logout }}>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <PortalSidebar
          user={user}
          onLogout={logout}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Topbar mobile */}
          <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700 p-1"
              aria-label="Abrir menu"
            >
              ☰
            </button>
            <span className="font-semibold text-gray-800 text-sm">
              Portal Azul Coworking
            </span>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </PortalAuthContext.Provider>
  );
}
