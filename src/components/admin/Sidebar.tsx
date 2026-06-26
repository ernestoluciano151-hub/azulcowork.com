"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/leads", label: "Leads", icon: "👥" }
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-white/10 bg-ink2 p-5">
      <div className="font-display text-lg font-bold text-paper">
        CRM <span className="text-azul-glow">·</span> Leads
      </div>

      <nav className="mt-8 flex-1 space-y-1">
        {links.map((link) => (
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
            <span aria-hidden>{link.icon}</span> {link.label}
          </Link>
        ))}
      </nav>

      <button
        onClick={logout}
        className="focus-ring rounded-lg border border-white/10 px-3 py-2.5 text-sm text-mist transition hover:bg-white/5 hover:text-paper"
      >
        Sair
      </button>
    </aside>
  );
}
