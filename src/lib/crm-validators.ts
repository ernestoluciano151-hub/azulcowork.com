/**
 * crm-validators.ts — Validadores do módulo CRM
 *
 * Todas as funções são puras (sem side effects) para facilitar testes unitários.
 * Ver: docs/04-crm/testing.md
 */

import { isValidEmail, sanitizeText } from "@/lib/validators";
import { PipelineStage } from "@prisma/client";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface CreateCompanyInput {
  name: string;
  nif?: string;
  email?: string;
  phone?: string;
  website?: string;
  sector?: string;
  country?: string;
  assignedToId?: string;
  pipelineStage?: PipelineStage;
  // Contacto primário opcional na criação
  contactFirstName?: string;
  contactLastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  tags?: string[]; // tag IDs
}

export type ValidationResult =
  | { ok: true; data: CreateCompanyInput }
  | { ok: false; status: number; error: string };

// ── Constantes ───────────────────────────────────────────────────────────────

const VALID_PIPELINE_STAGES = Object.values(PipelineStage);
const MAX_TAGS              = 20;
const NIF_ANGOLA_RE         = /^\d{10}$/;

// ── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Valida e sanitiza os dados de criação de empresa.
 * Retorna `{ ok: true, data }` ou `{ ok: false, status, error }`.
 */
export function validateCreateCompany(raw: Record<string, unknown>): ValidationResult {
  // name — obrigatório, mín. 2 caracteres
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name.length < 2) {
    return { ok: false, status: 400, error: "O nome da empresa deve ter pelo menos 2 caracteres." };
  }

  // nif — opcional mas se presente deve ser 10 dígitos (Angola)
  const nif = typeof raw.nif === "string" ? raw.nif.replace(/\s/g, "") : undefined;
  if (nif && !NIF_ANGOLA_RE.test(nif)) {
    return { ok: false, status: 400, error: "NIF inválido. Deve ter exactamente 10 dígitos." };
  }

  // email — opcional mas se presente deve ser válido
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : undefined;
  if (email && !isValidEmail(email)) {
    return { ok: false, status: 400, error: "E-mail inválido." };
  }

  // contactEmail — opcional mas se presente deve ser válido
  const contactEmail = typeof raw.contactEmail === "string"
    ? raw.contactEmail.trim().toLowerCase()
    : undefined;
  if (contactEmail && !isValidEmail(contactEmail)) {
    return { ok: false, status: 400, error: "E-mail do contacto inválido." };
  }

  // pipelineStage — opcional, default NEW_LEAD
  const rawStage = typeof raw.pipelineStage === "string" ? raw.pipelineStage : "NEW_LEAD";
  if (!VALID_PIPELINE_STAGES.includes(rawStage as PipelineStage)) {
    return { ok: false, status: 400, error: `pipelineStage inválido. Valores aceites: ${VALID_PIPELINE_STAGES.join(", ")}.` };
  }
  const pipelineStage = rawStage as PipelineStage;

  // tags — opcional, máximo MAX_TAGS
  const tags = Array.isArray(raw.tags) ? (raw.tags as unknown[]).filter((t): t is string => typeof t === "string") : undefined;
  if (tags && tags.length > MAX_TAGS) {
    return { ok: false, status: 400, error: `Máximo de ${MAX_TAGS} tags por empresa.` };
  }

  return {
    ok: true,
    data: {
      name:             sanitizeText(name),
      nif:              nif || undefined,
      email:            email || undefined,
      phone:            typeof raw.phone === "string" ? sanitizeText(raw.phone.trim()) : undefined,
      website:          typeof raw.website === "string" ? sanitizeText(raw.website.trim()) : undefined,
      sector:           typeof raw.sector === "string" ? sanitizeText(raw.sector.trim()) : undefined,
      country:          typeof raw.country === "string" ? sanitizeText(raw.country.trim()) : "Angola",
      assignedToId:     typeof raw.assignedToId === "string" ? raw.assignedToId : undefined,
      pipelineStage,
      contactFirstName: typeof raw.contactFirstName === "string" ? sanitizeText(raw.contactFirstName.trim()) : undefined,
      contactLastName:  typeof raw.contactLastName === "string" ? sanitizeText(raw.contactLastName.trim()) : undefined,
      contactEmail,
      contactPhone:     typeof raw.contactPhone === "string" ? sanitizeText(raw.contactPhone.trim()) : undefined,
      tags,
    },
  };
}

/**
 * Verifica se dois nomes de empresas são suficientemente semelhantes
 * para serem considerados potenciais duplicados (threshold ≥ 85%).
 * Algoritmo: distância de Levenshtein normalizada.
 */
export function similarityScore(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  return (maxLen - levenshtein(s1, s2)) / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
