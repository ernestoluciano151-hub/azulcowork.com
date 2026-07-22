// Proteção simples anti-spam: limita submissões por IP em memória (janela deslizante).
// Em produção com múltiplas instâncias, troque por Redis (Upstash) com a mesma interface.

type Hit = { count: number; firstHit: number };

// Loja separada para leads públicos vs tentativas de login (limites diferentes)
const leadStore  = new Map<string, Hit>();
const loginStore = new Map<string, Hit>();

const LEAD_WINDOW_MS  = 10 * 60 * 1000; // 10 minutos
const LEAD_MAX_HITS   = 5;

// Login: 10 tentativas por 15 minutos por IP (brute-force protection)
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_HITS  = 10;

function checkStore(store: Map<string, Hit>, ip: string, windowMs: number, maxHits: number): boolean {
  const now = Date.now();
  const hit = store.get(ip);

  if (!hit || now - hit.firstHit > windowMs) {
    store.set(ip, { count: 1, firstHit: now });
    return false;
  }

  hit.count += 1;
  if (hit.count > maxHits) return true;
  return false;
}

export function isRateLimited(ip: string): boolean {
  return checkStore(leadStore, ip, LEAD_WINDOW_MS, LEAD_MAX_HITS);
}

export function isLoginRateLimited(ip: string): boolean {
  return checkStore(loginStore, ip, LOGIN_WINDOW_MS, LOGIN_MAX_HITS);
}

// Validação de honeypot + tempo mínimo de preenchimento (bots costumam submeter instantaneamente)
export function looksLikeBot(formStartedAt: number, honeypot: string): boolean {
  if (honeypot && honeypot.trim().length > 0) return true;
  const elapsed = Date.now() - formStartedAt;
  if (elapsed < 1500) return true; // submeteu em menos de 1.5s = suspeito
  return false;
}
