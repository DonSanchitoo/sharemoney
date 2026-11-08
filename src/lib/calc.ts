import { convert, distribute } from './money';
import type { ExpenseData, Item, MemberData } from './types';

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/**
 * Remboursements minimaux : on apparie à chaque fois le plus gros débiteur
 * avec le plus gros créancier. Au plus n-1 virements pour n personnes.
 */
export function settle(balances: Record<string, number>, roundTo = 1): Transfer[] {
  const debt = Object.entries(balances)
    .filter(([, v]) => v < -0.5)
    .map(([id, v]) => ({ id, v: -v }));
  const cred = Object.entries(balances)
    .filter(([, v]) => v > 0.5)
    .map(([id, v]) => ({ id, v }));
  const out: Transfer[] = [];
  let guard = 0;
  while (debt.length && cred.length && guard++ < 1000) {
    debt.sort((a, b) => b.v - a.v);
    cred.sort((a, b) => b.v - a.v);
    const d = debt[0], c = cred[0];
    const amt = Math.min(d.v, c.v);
    const shown = roundTo > 1 ? Math.round(amt / roundTo) * roundTo : amt;
    if (shown > 0) out.push({ from: d.id, to: c.id, amount: shown });
    d.v -= amt;
    c.v -= amt;
    if (d.v < 0.5) debt.shift();
    if (c.v < 0.5) cred.shift();
  }
  return out;
}

/** Montant d'une dépense converti en devise projet. */
export function baseAmount(e: ExpenseData): number {
  return convert(e.amount, e.rate);
}

/** Part de chaque participant pour un montant donné (devise projet). */
export function splitShares(total: number, split: ExpenseData['split']): Record<string, number> {
  const parts = split?.parts || {};
  switch (split?.mode) {
    case 'amounts': {
      // Montants saisis en devise d'origine : on les remet à l'échelle du total converti.
      const sum = Object.values(parts).reduce((s, v) => s + (v > 0 ? v : 0), 0);
      if (!sum) return {};
      return distribute(total, parts);
    }
    case 'shares':
    case 'percent':
      return distribute(total, parts);
    case 'equal':
    default: {
      const w: Record<string, number> = {};
      for (const k of Object.keys(parts)) if (parts[k] > 0) w[k] = 1;
      return distribute(total, w);
    }
  }
}

export interface BalanceReport {
  balance: Record<string, number>; // > 0 : doit recevoir
  paid: Record<string, number>; // dépenses avancées
  consumed: Record<string, number>; // part des dépenses
  total: number; // total des dépenses (hors transferts)
  byCategory: Record<string, number>;
  byDay: Record<string, number>;
}

export function computeBalances(expenses: Item<ExpenseData>[], memberIds: string[]): BalanceReport {
  const z = () => Object.fromEntries(memberIds.map((id) => [id, 0])) as Record<string, number>;
  const balance = z(), paid = z(), consumed = z();
  const byCategory: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  let total = 0;
  const add = (m: Record<string, number>, k: string | undefined, v: number) => {
    if (!k) return;
    m[k] = (m[k] || 0) + v;
  };

  for (const it of expenses) {
    const e = it.data;
    const v = baseAmount(e);
    if (!v) continue;
    if (e.kind === 'transfer') {
      add(balance, e.payer, v);
      add(balance, e.to, -v);
      continue;
    }
    const shares = splitShares(v, e.split);
    if (e.kind === 'income') {
      add(balance, e.payer, -v);
      for (const [k, s] of Object.entries(shares)) add(balance, k, s);
      continue;
    }
    total += v;
    add(paid, e.payer, v);
    add(balance, e.payer, v);
    for (const [k, s] of Object.entries(shares)) {
      add(consumed, k, s);
      add(balance, k, -s);
    }
    add(byCategory, e.category || 'other', v);
    add(byDay, e.date, v);
  }
  return { balance, paid, consumed, total, byCategory, byDay };
}

/** Participants par défaut d'une nouvelle dépense (hors personnes fêtées et archivées). */
export function defaultSplit(members: Item<MemberData>[]): ExpenseData['split'] {
  const active = members.filter((m) => !m.data.archived && !m.data.honoree);
  const list = active.length ? active : members.filter((m) => !m.data.archived);
  const weighted = list.some((m) => (m.data.weight ?? 1) !== 1);
  const parts: Record<string, number> = {};
  for (const m of list) parts[m.id] = weighted ? m.data.weight ?? 1 : 1;
  return { mode: weighted ? 'shares' : 'equal', parts };
}

/** Vérifie la cohérence d'une répartition ; renvoie un message d'erreur ou null. */
export function splitError(amount: number, split: ExpenseData['split']): string | null {
  const vals = Object.values(split.parts).filter((v) => v > 0);
  if (!vals.length) return 'Choisis au moins une personne.';
  if (split.mode === 'amounts') {
    const sum = vals.reduce((s, v) => s + v, 0);
    if (sum !== amount) {
      const diff = amount - sum;
      return diff > 0 ? `Il reste ${(diff / 100).toFixed(2).replace('.', ',')} à répartir.` : `Dépassement de ${(-diff / 100).toFixed(2).replace('.', ',')}.`;
    }
  }
  if (split.mode === 'percent') {
    const sum = vals.reduce((s, v) => s + v, 0);
    if (Math.abs(sum - 100) > 0.01) return `Le total fait ${Math.round(sum * 100) / 100} % au lieu de 100 %.`;
  }
  return null;
}
