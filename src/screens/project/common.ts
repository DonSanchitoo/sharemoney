import { computeBalances } from '../../lib/calc';
import { getProject, itemsOf, meOf } from '../../lib/store';
import type { Category, ExpenseData, GroupData, Item, MemberData, Project } from '../../lib/types';
import { CATEGORY_CATALOG } from '../../lib/presets';

export function useGroup(projectId: string) {
  const p = getProject<GroupData>(projectId);
  const members = itemsOf<MemberData>(projectId, 'member')
    .slice()
    .sort((a, b) => (a.data.name || '').localeCompare(b.data.name || '', 'fr'));
  const expenses = itemsOf<ExpenseData>(projectId, 'expense')
    .slice()
    .sort((a, b) => (b.data.date || '').localeCompare(a.data.date || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const names: Record<string, string> = {};
  for (const m of members) names[m.id] = m.data.name || 'Sans nom';
  const me = meOf(projectId);
  const report = computeBalances(expenses, members.map((m) => m.id));
  const people = members.filter((m) => !m.data.archived).map((m) => ({ id: m.id, name: m.data.name, color: m.data.color }));
  const allPeople = members.map((m) => ({ id: m.id, name: m.data.name, color: m.data.color }));
  const readOnly = !!p?.data.options?.archived;
  return { p, members, expenses, names, me, report, people, allPeople, readOnly };
}

export type Group = ReturnType<typeof useGroup> & { p: Project<GroupData> };

export function categoryOf(p: Project<GroupData> | undefined, id: string | undefined): Category {
  const cats = p?.data.categories || [];
  return cats.find((c) => c.id === id) || CATEGORY_CATALOG[id || 'other'] || CATEGORY_CATALOG.other;
}

export function memberName(names: Record<string, string>, id: string | undefined, me?: string): string {
  if (!id) return '?';
  if (id === me) return 'Moi';
  return names[id] || 'Ancien membre';
}

export function expenseLabel(e: Item<ExpenseData>['data'], names: Record<string, string>, me?: string): string {
  if (e.kind === 'transfer') return `${memberName(names, e.payer, me)} → ${memberName(names, e.to, me)}`;
  if (e.kind === 'income') return `Reçu par ${memberName(names, e.payer, me)}`;
  return `Payé par ${memberName(names, e.payer, me)}`;
}
