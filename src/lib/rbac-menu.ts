/**
 * rbac-menu.ts — Páginas visíveis/acessíveis por papel (pedido do PO, 18 Out 2026).
 * ADMIN vê tudo. Os restantes papéis só vêem os módulos listados — o menu esconde o
 * resto e o middleware bloqueia o acesso directo por URL. As API Routes continuam a
 * aplicar `requireRole` (defesa em profundidade). Módulo puro (seguro para o Edge).
 */
export type RoleName = "ADMIN" | "COMERCIAL" | "FINANCEIRO" | "VIEWER";

const ROLE_PATHS: Record<Exclude<RoleName, "ADMIN">, string[]> = {
  // Operações / comercial: CRM, leads, empresas, atividades, reservas, calendário
  COMERCIAL: [
    "/admin/dashboard", "/admin/leads", "/admin/leads-salas", "/admin/empresas",
    "/admin/atividades", "/admin/salas", "/admin/calendario", "/admin/crm", "/admin/settings",
  ],
  // Financeiro: empresas, atividades, pagamentos e ERP financeiro
  FINANCEIRO: [
    "/admin/dashboard", "/admin/empresas", "/admin/atividades", "/admin/pagamentos",
    "/admin/financeiro", "/admin/erp/contratos", "/admin/erp/faturas", "/admin/erp/despesas",
    "/admin/erp/fluxo-caixa", "/admin/settings",
  ],
  // Só leitura (ex.: Director): visão geral, empresas, reservas e calendário
  VIEWER: [
    "/admin/dashboard", "/admin/empresas", "/admin/salas", "/admin/calendario", "/admin/settings",
  ],
};

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function canAccessPath(role: string | undefined | null, pathname: string): boolean {
  if (role === "ADMIN") return true;
  if (pathname === "/admin" || pathname === "/admin/") return true;
  const allowed = ROLE_PATHS[role as Exclude<RoleName, "ADMIN">];
  if (!allowed) return false;
  return allowed.some((p) => matches(pathname, p));
}
