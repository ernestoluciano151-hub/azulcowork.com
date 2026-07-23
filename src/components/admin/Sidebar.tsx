"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "./NotificationBell";

const links = [
  { href: "/admin/dashboard",      label: "Dashboard",      icon: "📊", adminOnly: false },
  { href: "/admin/leads",                label: "Leads",           icon: "👥", adminOnly: false },
  { href: "/admin/leads/convertidos",    label: "Convertidos",     icon: "✅", adminOnly: false },
  { href: "/admin/leads-salas",          label: "Leads Salas",     icon: "🏨", adminOnly: false },
  { href: "/admin/empresas",       label: "Empresas",       icon: "🏢", adminOnly: false },
  { href: "/admin/pagamentos",     label: "Pagamentos",     icon: "💳", adminOnly: false },
  { href: "/admin/salas",             label: "Sala de Reunião",  icon: "🚪", adminOnly: false },
  { href: "/admin/salas/relatorios", label: "Rel. Salas",       icon: "📊", adminOnly: false },
  { href: "/admin/calendario",       label: "Calendário",       icon: "📅", adminOnly: false },
  { href: "/admin/delete-requests",        label: "Aprovações",      icon: "🗑️", adminOnly: true, badge: true },
  { href: "/admin/configuracoes/precos",   label: "Preços da Sala",  icon: "💰", adminOnly: true },
  { href: "/admin/configuracoes/sala",     label: "Config. Sala",    icon: "⚙️", adminOnly: true },
  { href: "/admin/settings",               label: "Definições",      icon: "🔧", adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingDeletes, setPendingDeletes] = useState(0);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setRole(d.role); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (role !== "ADMIN") return;
    fetch("/api/delete-requests")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && Array.isArray(d.requests)) setPendingDeletes(d.requests.length); })
      .catch(() => {});
  }, [pathname, role]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const visibleLinks = links.filter(l => !l.adminOnly || role === "ADMIN");

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-white/10 bg-ink2 p-5">
      <div className="font-display text-lg font-bold text-paper">
        CRM <span className="text-azul-glow">·</span> Leads
      </div>

      <nav className="mt-8 flex-1 space-y-1">
        {visibleLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              pathname === link.href
                ? "bg-azul/15 text-paper"
                : "text-mist hover:bg-white/5 hover:text-paper"
            ].join(" ")}
          >
            <span aria-hidden>{link.icon}</span>
            <span className="flex-1">{link.label}</span>
            {link.badge && pendingDeletes > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {pendingDeletes}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <GlobalSearch />

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={logout}
          className="focus-ring flex-1 rounded-lg border border-white/10 px-3 py-2.5 text-sm text-mist transition hover:bg-white/5 hover:text-paper"
        >
          Sair
        </button>
        <NotificationBell />
      </div>
    </aside>
  );
}
