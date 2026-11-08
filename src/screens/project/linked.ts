import { getRate } from '../../lib/fx';
import { db, deleteItem, putItem } from '../../lib/store';
import type { ExpenseData } from '../../lib/types';
import type { Group } from './common';

/**
 * Crée ou met à jour la dépense liée à un billet / hébergement.
 * Renvoie l'id de la dépense (ou undefined si supprimée).
 */
export async function upsertLinkedExpense(
  g: Group,
  link: { type: 'ticket' | 'lodging'; id: string },
  opts: {
    enabled: boolean;
    expenseId?: string;
    title: string;
    amount?: number;
    currency?: string;
    payer?: string;
    participants: string[];
    category: string;
    date: string;
  }
): Promise<string | undefined> {
  const existing = opts.expenseId ? db.value.items[opts.expenseId] : undefined;
  if (!opts.enabled || !opts.amount || !opts.payer) {
    if (existing && !existing.deleted) deleteItem(existing.id);
    return undefined;
  }
  const base = g.p.data.currency;
  const currency = opts.currency || base;
  let rate = 1;
  if (currency !== base) {
    const prev = existing?.data as ExpenseData | undefined;
    rate = prev && prev.currency === currency && prev.rate ? prev.rate : (await getRate(currency, base))?.rate ?? 1;
  }
  const people = opts.participants.length ? opts.participants : g.people.map((p) => p.id);
  const cats = g.p.data.categories.map((c) => c.id);
  const prev = existing && !existing.deleted ? (existing.data as ExpenseData) : undefined;
  const data: ExpenseData = {
    ...(prev || {}),
    kind: 'expense',
    title: opts.title,
    amount: opts.amount,
    currency,
    rate,
    payer: opts.payer,
    date: opts.date,
    category: cats.includes(opts.category) ? opts.category : prev?.category || 'other',
    split: { mode: 'equal', parts: Object.fromEntries(people.map((id) => [id, 1])) },
    link,
    createdBy: prev?.createdBy || g.me,
  };
  return putItem<ExpenseData>(g.p.id, 'expense', data, prev ? existing!.id : undefined);
}
