/**
 * rateLimit.ts — Protecção anti-spam e anti-brute-force em memória.
 *
 * Implementação com janela deslizante (sliding window) por IP.
 * Em produção com múltiplas instâncias, substituir pelo módulo Upstash Redis
 * usando a mesma interface pública (isRateLimited, isLoginRateLimited, isApiRateLimited).
 *
 * Lojas independentes por domínio para limites diferentes:
 *  - leadStore:  formulário público (5 submissões / 10 min)
 *  - loginStore: tentativas de login (10 tentativas / 15 min)
 *  - apiStore:   API Routes de mutação (60 pedidos / 1 min)
 *  - totpStore:  verificação TOTP (5 tentativas / 5 min — brute-force TOTP)
 */

type Hit = { count: number; firstHit: number };

// Lojas isoladas por domínio
const leadStore  = new Map<string, Hit>();
const loginStore = new Map<string, Hit>();
const apiStore   = new Map<string, Hit>();
const totpStore  = new Map<string, Hit>();

// Formulário público: 5 submissões por 10 minutos por IP
const LEAD_WINDOW_MS  = 10 * 60 * 1000;
const LEAD_MAX_HITS   = 5;

// Login: 10 tentativas por 15 minutos por IP (brute-force password)
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_HITS  = 10;

// API Routes autenticadas: 60 mutações por minuto por IP
const API_WINDOW_MS   = 60 * 1000;
const API_MAX_HITS    = 60;

// TOTP: 5 tentativas por 5 minutos por IP (brute-force de código 6 dígitos)
const TOTP_WINDOW_MS  = 5 * 60 * 1000;
const TOTP_MAX_HITS   = 5;

function checkStore(
  store: Map<string, Hit>,
  key: string,
  windowMs: number,
  maxHits: number
): boolean {
  const now = Date.now();
  const hit = store.get(key);

  if (!hit || now - hit.firstHit > windowMs) {
    store.set(key, { count: 1, firstHit: now });
    return false;
  }

  hit.count += 1;
  return hit.count > maxHits;
}

/** Formulário público de leads — 5 submissões / 10 min */
export function isRateLimited(ip: string): boolean {
  return checkStore(leadStore, ip, LEAD_WINDOW_MS, LEAD_MAX_HITS);
}

/** Tentativas de login — 10 / 15 min */
export function isLoginRateLimited(ip: string): boolean {
  return checkStore(loginStore, ip, LOGIN_WINDOW_MS, LOGIN_MAX_HITS);
}

/**
 * API Routes de mutação autenticadas — 60 pedidos / min.
 *
 * Usar `key` para isolar por endpoint quando necessário.
 * Ex: isApiRateLimited(ip, "payments") para limitar payments separadamente.
 *
 * @param ip  - IP do cliente
 * @param key - Chave de namespace (ex: "payments", "invoices", "admin-users")
 */
export function isApiRateLimited(ip: string, key: string = "global"): boolean {
  return checkStore(apiStore, `${ip}:${key}`, API_WINDOW_MS, API_MAX_HITS);
}

/** Verificação TOTP — 5 tentativas / 5 min (previne brute-force de códigos 6 dígitos) */
export function isTotpRateLimited(ip: string): boolean {
  return checkStore(totpStore, ip, TOTP_WINDOW_MS, TOTP_MAX_HITS);
}

// Validação de honeypot + tempo mínimo de preenchimento (bots costumam submeter instantaneamente)
export function looksLikeBot(formStartedAt: number, honeypot: string): boolean {
  if (honeypot && honeypot.trim().length > 0) return true;
  const elapsed = Date.now() - formStartedAt;
  if (elapsed < 1500) return true; // submeteu em menos de 1.5s = suspeito
  return false;
}
