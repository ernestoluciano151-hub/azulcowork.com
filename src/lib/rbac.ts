/**
 * RBAC — re-export de compatibilidade.
 * A implementação real vive em src/lib/auth.ts (SSoT).
 * Vários routes importam de "@/lib/rbac"; este shim evita duplicação.
 */
export { requireRole, requireSession } from "@/lib/auth";
export type { AuthResult } from "@/lib/auth";
