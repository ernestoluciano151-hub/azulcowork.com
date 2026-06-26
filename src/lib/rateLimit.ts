// Proteção simples anti-spam: limita submissões por IP em memória (janela deslizante).
// Em produção com múltiplas instâncias, troque por Redis (Upstash) com a mesma interface.

type Hit = { count: number; firstHit: number };
const store = new Map<string, Hit>();

const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_HITS = 5; // máximo de submissões por IP na janela

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hit = store.get(ip);

  if (!hit || now - hit.firstHit > WINDOW_MS) {
    store.set(ip, { count: 1, firstHit: now });
    return false;
  }

  hit.count += 1;
  if (hit.count > MAX_HITS) return true;
  return false;
}

// Validação de honeypot + tempo mínimo de preenchimento (bots costumam submeter instantaneamente)
export function looksLikeBot(formStartedAt: number, honeypot: string): boolean {
  if (honeypot && honeypot.trim().length > 0) return true;
  const elapsed = Date.now() - formStartedAt;
  if (elapsed < 1500) return true; // submeteu em menos de 1.5s = suspeito
  return false;
}
