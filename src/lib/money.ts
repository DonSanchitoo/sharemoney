/**
 * Tous les montants sont stockés en entiers « centimes » (montant × 100),
 * quelle que soit la devise, pour éviter les erreurs d'arrondi.
 */

export function parseAmount(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) : 0;
  const s = String(v).replace(/[\s  €$£]/g, '').replace(',', '.');
  if (!s) return 0;
  const n = parseFloat(s);
  return isFinite(n) ? Math.round(n * 100) : 0;
}

/** Texte éditable à partir de centimes : 1234 → "12,34", 1200 → "12". */
export function amountToInput(cents: number | null | undefined): string {
  if (!cents) return '';
  const v = cents / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',');
}

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(currency: string, compact = false): Intl.NumberFormat {
  const key = currency + (compact ? ':c' : '');
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency,
        ...(compact ? { maximumFractionDigits: 0 } : {}),
      });
    } catch {
      f = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
    }
    formatters.set(key, f);
  }
  return f;
}

export function fmt(cents: number, currency = 'EUR'): string {
  return formatter(currency).format((cents || 0) / 100);
}

export function fmtCompact(cents: number, currency = 'EUR'): string {
  return formatter(currency, true).format((cents || 0) / 100);
}

export function fmtSigned(cents: number, currency = 'EUR'): string {
  const s = fmt(Math.abs(cents), currency);
  if (Math.abs(cents) < 1) return fmt(0, currency);
  return (cents > 0 ? '+' : '−') + s;
}

/** Conversion vers la devise du projet : rate = valeur d'1 unité de la devise en devise projet. */
export function convert(cents: number, rate: number | undefined): number {
  return Math.round(cents * (rate && isFinite(rate) && rate > 0 ? rate : 1));
}

/**
 * Répartit un total entier selon des poids, sans perdre un centime
 * (méthode du plus fort reste). L'ordre des clés départage les égalités.
 */
export function distribute(total: number, weights: Record<string, number>): Record<string, number> {
  const ids = Object.keys(weights).filter((k) => weights[k] > 0);
  const out: Record<string, number> = {};
  for (const k of Object.keys(weights)) out[k] = 0;
  const sum = ids.reduce((s, k) => s + weights[k], 0);
  if (!ids.length || sum <= 0 || !total) return out;
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  let used = 0;
  const rest: { k: string; r: number }[] = [];
  for (const k of ids) {
    const exact = (abs * weights[k]) / sum;
    const base = Math.floor(exact + 1e-9);
    out[k] = base;
    used += base;
    rest.push({ k, r: exact - base });
  }
  rest.sort((a, b) => b.r - a.r);
  for (let i = 0; used < abs; i = (i + 1) % rest.length) {
    out[rest[i].k] += 1;
    used += 1;
  }
  if (sign < 0) for (const k of ids) out[k] = -out[k];
  return out;
}

export const CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY', 'CNY', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK', 'ISK',
  'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'MAD', 'TND', 'DZD', 'EGP', 'XOF', 'XPF', 'MUR', 'ZAR',
  'AED', 'INR', 'THB', 'VND', 'IDR', 'KRW', 'SGD', 'HKD', 'MXN', 'BRL', 'ARS', 'CLP', 'PEN', 'COP',
];

let displayNames: Intl.DisplayNames | null = null;
export function currencyName(code: string): string {
  try {
    displayNames ??= new Intl.DisplayNames(['fr'], { type: 'currency' });
    const n = displayNames.of(code);
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : code;
  } catch {
    return code;
  }
}

export function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? code;
  } catch {
    return code;
  }
}
