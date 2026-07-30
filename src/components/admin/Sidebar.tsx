"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GlobalSearch from "./GlobalSearch";

const links = [
  { href: "/admin/dashboard",            label: "Dashboard",       icon: "📊", adminOnly: false, group: "geral" },
  { href: "/admin/leads",                label: "Leads",           icon: "👥", adminOnly: false, group: "geral" },
  { href: "/admin/leads/convertidos",    label: "Convertidos",     icon: "✅", adminOnly: false, group: "geral" },
  { href: "/admin/leads-salas",          label: "Leads Salas",     icon: "🏨", adminOnly: false, group: "geral" },
  { href: "/admin/empresas",             label: "Empresas",        icon: "🏢", adminOnly: false, group: "geral" },
  { href: "/admin/atividades",           label: "Atividades",      icon: "📋", adminOnly: false, group: "geral" },
  { href: "/admin/pagamentos",           label: "Pagamentos",      icon: "💳", adminOnly: false, group: "geral" },
  { href: "/admin/salas",                label: "Sala de Reunião", icon: "🚪", adminOnly: false, group: "geral" },
  { href: "/admin/salas/relatorios",     label: "Rel. Salas",      icon: "📊", adminOnly: false, group: "geral" },
  { href: "/admin/calendario",           label: "Calendário",      icon: "📅", adminOnly: false, group: "geral" },
  { href: "/admin/delete-requests",      label: "Aprovações",      icon: "🗑️", adminOnly: true,  group: "geral", badge: true },
  { href: "/admin/configuracoes/precos", label: "Preços da Sala",  icon: "💰", adminOnly: true,  group: "geral" },
  { href: "/admin/configuracoes/sala",   label: "Config. Sala",    icon: "⚙️", adminOnly: true,  group: "geral" },
  // ── Documentos ────────────────────────────────────────────────────────────
  { href: "/admin/documentos",                                  label: "Documentos Gerados",  icon: "📄", adminOnly: true,  group: "documentos" },
  { href: "/admin/configuracoes/document-templates",            label: "Templates Docs",      icon: "📝", adminOnly: true,  group: "documentos" },
  // ── Comunicação ───────────────────────────────────────────────────────────
  { href: "/admin/comunicacao",                         label: "Histórico Comun.", icon: "📨", adminOnly: true,  group: "comunicacao" },
  { href: "/admin/configuracoes/email-templates",       label: "Templates Email",  icon: "✉️",  adminOnly: true,  group: "comunicacao" },
  // ── Segurança & Admin ─────────────────────────────────────────────────────
  { href: "/admin/settings",             label: "Definições",      icon: "🔧", adminOnly: true,  group: "seguranca" },
  { href: "/admin/auditoria",            label: "Auditoria",       icon: "🔍", adminOnly: true,  group: "seguranca" },
  // ── ERP Financeiro ────────────────────────────────────────────────────────
  { href: "/admin/erp/contratos",        label: "Contratos",       icon: "📋", adminOnly: false, group: "erp" },
  { href: "/admin/erp/faturas",          label: "Faturas",         icon: "🧾", adminOnly: false, group: "erp" },
  { href: "/admin/erp/despesas",         label: "Despesas",        icon: "💸", adminOnly: false, group: "erp" },
  { href: "/admin/erp/fluxo-caixa",     label: "Fluxo de Caixa",  icon: "📈", adminOnly: false, group: "erp" },
  { href: "/admin/erp/relatorios",       label: "Relatórios",      icon: "📑", adminOnly: true,  group: "erp" },
  // ── Portal Clientes ───────────────────────────────────────────────────────
  { href: "/admin/portal/utilizadores",  label: "Utilizadores Portal", icon: "🔑", adminOnly: true, group: "portal" },
  // ── CRM ──────────────────────────────────────────────────────────────────
  { href: "/admin/crm/dashboard",        label: "CRM Dashboard",   icon: "🎯", adminOnly: false, group: "crm" },
  { href: "/admin/crm",                  label: "Empresas CRM",    icon: "🏗️", adminOnly: false, group: "crm" },
  { href: "/admin/crm/kanban",           label: "Kanban",          icon: "📌", adminOnly: false, group: "crm" },
  { href: "/admin/crm/tarefas",          label: "As Minhas Tasks", icon: "✅", adminOnly: false, group: "crm" },
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

      <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
        {/* Secção Geral */}
        {visibleLinks.filter(l => l.group === "geral").map((link) => (
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

        {/* Separador Documentos */}
        {visibleLinks.some(l => l.group === "documentos") && (
          <div className="pt-3 pb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-azul-glow/70">
              Documentos
            </p>
          </div>
        )}

        {/* Secção Documentos */}
        {visibleLinks.filter(l => l.group === "documentos").map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              pathname === link.href || pathname?.startsWith(link.href + "/")
                ? "bg-azul/15 text-paper"
                : "text-mist hover:bg-white/5 hover:text-paper"
            ].join(" ")}
          >
            <span aria-hidden>{link.icon}</span>
            <span className="flex-1">{link.label}</span>
          </Link>
        ))}

        {/* Separador Comunicação */}
        {visibleLinks.some(l => l.group === "comunicacao") && (
          <div className="pt-3 pb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-azul-glow/70">
              Comunicação
            </p>
          </div>
        )}

        {/* Secção Comunicação */}
        {visibleLinks.filter(l => l.group === "comunicacao").map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              pathname === link.href || pathname?.startsWith(link.href + "/")
                ? "bg-azul/15 text-paper"
                : "text-mist hover:bg-white/5 hover:text-paper"
            ].join(" ")}
          >
            <span aria-hidden>{link.icon}</span>
            <span className="flex-1">{link.label}</span>
          </Link>
        ))}

        {/* Separador Segurança */}
        {visibleLinks.some(l => l.group === "seguranca") && (
          <div className="pt-3 pb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-azul-glow/70">
              Segurança & Admin
            </p>
          </div>
        )}

        {/* Secção Segurança */}
        {visibleLinks.filter(l => l.group === "seguranca").map((link) => (
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
          </Link>
        ))}

        {/* Separador ERP */}
        {visibleLinks.some(l => l.group === "erp") && (
          <div className="pt-3 pb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-azul-glow/70">
              ERP Financeiro
            </p>
          </div>
        )}

        {/* Secção ERP */}
        {visibleLinks.filter(l => l.group === "erp").map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              pathname === link.href || pathname?.startsWith(link.href + "/")
                ? "bg-azul/15 text-paper"
                : "text-mist hover:bg-white/5 hover:text-paper"
            ].join(" ")}
          >
            <span aria-hidden>{link.icon}</span>
            <span className="flex-1">{link.label}</span>
          </Link>
        ))}

        {/* Separador Portal */}
        {visibleLinks.some(l => l.group === "portal") && (
          <div className="pt-3 pb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-azul-glow/70">
              Portal Clientes
            </p>
          </div>
        )}

        {/* Secção Portal */}
        {visibleLinks.filter(l => l.group === "portal").map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              pathname === link.href || pathname?.startsWith(link.href + "/")
                ? "bg-azul/15 text-paper"
                : "text-mist hover:bg-white/5 hover:text-paper"
            ].join(" ")}
          >
            <span aria-hidden>{link.icon}</span>
            <span className="flex-1">{link.label}</span>
          </Link>
        ))}

        {/* Separador CRM */}
        <div className="pt-3 pb-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-azul-glow/70">
            CRM Comercial
          </p>
        </div>

        {/* Secção CRM */}
        {visibleLinks.filter(l => l.group === "crm").map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              pathname === link.href || pathname?.startsWith(link.href + "/")
                ? "bg-azul/15 text-paper"
                : "text-mist hover:bg-white/5 hover:text-paper"
            ].join(" ")}
          >
            <span aria-hidden>{link.icon}</span>
            <span className="flex-1">{link.label}</span>
          </Link>
        ))}
      </nav>

      <GlobalSearch />

      <button
        onClick={logout}
        className="focus-ring mt-3 w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm text-mist transition hover:bg-white/5 hover:text-paper"
      >
        Sair
      </button>
    </aside>
  );
}
