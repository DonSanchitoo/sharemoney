import { distribute } from './money';
import { settle, type Transfer } from './calc';
import type { RentLine, RentMonthData } from './types';

export interface RentResult {
  expenses: number; // total des dépenses
  aids: number; // total des aides reçues
  net: number; // reste à charge du foyer
  paid: Record<string, number>; // ce que chacun a payé
  got: Record<string, number>; // aides reçues par chacun
  share: Record<string, number>; // part nette à sa charge
  balance: Record<string, number>; // > 0 : doit recevoir
  transfers: Transfer[];
}

/** Pourcentages normalisés (égaux si rien n'est saisi). */
export function normShares(memberIds: string[], shares: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  const sum = memberIds.reduce((s, id) => s + Math.max(shares?.[id] ?? 0, 0), 0);
  for (const id of memberIds) out[id] = sum > 0 ? Math.max(shares?.[id] ?? 0, 0) : 1;
  return out;
}

export function computeRent(month: Pick<RentMonthData, 'lines' | 'shares'>, memberIds: string[]): RentResult {
  const zero = () => Object.fromEntries(memberIds.map((id) => [id, 0])) as Record<string, number>;
  const paid = zero(), got = zero(), share = zero();
  const weights = normShares(memberIds, month.shares);
  let expenses = 0, aids = 0;

  for (const line of month.lines) {
    const amt = line.amount || 0;
    if (!amt) continue;
    const parts = (line.split && line.split.length ? line.split : memberIds).filter((id) => memberIds.includes(id));
    const w: Record<string, number> = {};
    for (const id of parts) w[id] = weights[id] ?? 0;
    if (!Object.values(w).some((x) => x > 0)) for (const id of parts) w[id] = 1;
    const dist = distribute(amt, w);
    const person = memberIds.includes(line.person) ? line.person : memberIds[0];
    if (line.kind === 'aid') {
      aids += amt;
      if (person) got[person] += amt;
      for (const [id, v] of Object.entries(dist)) share[id] -= v;
    } else {
      expenses += amt;
      if (person) paid[person] += amt;
      for (const [id, v] of Object.entries(dist)) share[id] += v;
    }
  }

  const balance = zero();
  for (const id of memberIds) balance[id] = paid[id] - got[id] - share[id];
  return { expenses, aids, net: expenses - aids, paid, got, share, balance, transfers: settle(balance) };
}

export function transferKey(t: Transfer): string {
  return `${t.from}>${t.to}`;
}

/**
 * Cherche qui devrait virer le loyer pour limiter les virements entre vous.
 * Renvoie la meilleure alternative si elle réduit le montant total échangé.
 */
export function bestRentPayer(month: Pick<RentMonthData, 'lines' | 'shares'>, memberIds: string[]):
  | { person: string; transfers: Transfer[]; moved: number; current: number }
  | null {
  const rentLines = month.lines.filter((l) => l.rent && l.amount > 0);
  if (!rentLines.length || memberIds.length < 2) return null;
  const total = (ts: Transfer[]) => ts.reduce((s, t) => s + t.amount, 0);
  const current = total(computeRent(month, memberIds).transfers);
  let best: { person: string; transfers: Transfer[]; moved: number; current: number } | null = null;
  for (const id of memberIds) {
    if (rentLines.every((l) => l.person === id)) continue;
    const lines: RentLine[] = month.lines.map((l) => (l.rent ? { ...l, person: id } : l));
    const r = computeRent({ ...month, lines }, memberIds);
    const moved = total(r.transfers);
    if (moved < current - 50 && (!best || moved < best.moved)) best = { person: id, transfers: r.transfers, moved, current };
  }
  return best;
}

/** Parts au prorata des revenus : { id: revenu } → { id: % arrondi à 0,1 }. */
export function sharesFromIncomes(incomes: Record<string, number>): Record<string, number> {
  const sum = Object.values(incomes).reduce((s, v) => s + Math.max(v, 0), 0);
  const out: Record<string, number> = {};
  if (!sum) return out;
  for (const [id, v] of Object.entries(incomes)) out[id] = Math.round((Math.max(v, 0) / sum) * 1000) / 10;
  return out;
}
