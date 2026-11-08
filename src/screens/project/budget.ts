import { fmt } from '../../lib/money';
import type { Group } from './common';
import { categoryOf } from './common';

export interface BudgetAlert {
  key: string;
  level: 'warn' | 'over';
  text: string;
  spent: number;
  budget: number;
}

/** Budgets atteints à 80 % ou dépassés (global et par catégorie). */
export function budgetAlerts(g: Group, byCategory = g.report.byCategory, total = g.report.total): BudgetAlert[] {
  const b = g.p.data.budget;
  const cur = g.p.data.currency;
  const out: BudgetAlert[] = [];
  if (!b) return out;
  const check = (key: string, label: string, spent: number, budget: number | undefined) => {
    if (!budget || budget <= 0) return;
    if (spent > budget) out.push({ key, level: 'over', spent, budget, text: `${label} dépassé : ${fmt(spent, cur)} sur ${fmt(budget, cur)} (+${fmt(spent - budget, cur)})` });
    else if (spent >= budget * 0.8) out.push({ key, level: 'warn', spent, budget, text: `${label} à ${Math.round((spent / budget) * 100)} % : ${fmt(spent, cur)} sur ${fmt(budget, cur)}` });
  };
  check('total', 'Budget total', total, b.total);
  for (const [cat, budget] of Object.entries(b.perCategory || {})) {
    const c = categoryOf(g.p, cat);
    check('cat:' + cat, `Budget ${c.label}`, byCategory[cat] || 0, budget);
  }
  return out.sort((a, b2) => (a.level === b2.level ? 0 : a.level === 'over' ? -1 : 1));
}
