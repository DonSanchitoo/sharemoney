/**
 * Taux de change : open.er-api.com (160 devises, sans clé), repli sur
 * frankfurter (taux BCE). Cache 12 h dans le navigateur.
 */

interface Cached {
  at: number;
  rates: Record<string, number>; // unités de devise pour 1 unité de base
}

const TTL = 12 * 3600 * 1000;
const mem = new Map<string, Cached>();

function readCache(base: string): Cached | null {
  if (mem.has(base)) return mem.get(base)!;
  try {
    const raw = localStorage.getItem('fx:' + base);
    if (raw) {
      const c = JSON.parse(raw) as Cached;
      mem.set(base, c);
      return c;
    }
  } catch {
    /* rien */
  }
  return null;
}

function writeCache(base: string, c: Cached) {
  mem.set(base, c);
  try {
    localStorage.setItem('fx:' + base, JSON.stringify(c));
  } catch {
    /* rien */
  }
}

async function fetchRates(base: string): Promise<Record<string, number>> {
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const j = await r.json();
    if (j && j.result === 'success' && j.rates) return j.rates;
  } catch {
    /* on tente le repli */
  }
  const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}`);
  const j = await r.json();
  if (!j || !j.rates) throw new Error('Taux indisponibles');
  return { ...j.rates, [base]: 1 };
}

/**
 * Taux pour convertir 1 unité de `from` en devise `to`.
 * Renvoie null si hors-ligne et sans cache.
 */
export async function getRate(from: string, to: string): Promise<{ rate: number; at: number } | null> {
  if (from === to) return { rate: 1, at: Date.now() };
  let c = readCache(to);
  if (!c || Date.now() - c.at > TTL || !c.rates[from]) {
    try {
      const rates = await fetchRates(to);
      c = { at: Date.now(), rates };
      writeCache(to, c);
    } catch {
      /* on garde l'ancien cache s'il existe */
    }
  }
  if (!c || !c.rates[from]) return null;
  return { rate: 1 / c.rates[from], at: c.at };
}
