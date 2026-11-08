import { uuidFrom, uuid } from '../../lib/ids';
import { db, itemsOf, putItem, rentProjects, setPrefs } from '../../lib/store';
import type { Item, Project, RentData, RentLine, RentMemberData, RentMonthData } from '../../lib/types';

export function currentHousehold(): Project<RentData> | undefined {
  const list = rentProjects.value as Project<RentData>[];
  const id = db.value.prefs.rentId;
  return list.find((p) => p.id === id) || list[0];
}

export function useHousehold(p: Project<RentData> | undefined) {
  const members = itemsOf<RentMemberData>(p?.id, 'member')
    .slice()
    .sort((a, b) => (a.data.name || '').localeCompare(b.data.name || '', 'fr'));
  const months = itemsOf<RentMonthData>(p?.id, 'month')
    .slice()
    .sort((a, b) => b.data.month.localeCompare(a.data.month));
  const names: Record<string, string> = {};
  for (const m of members) names[m.id] = m.data.name || 'Sans nom';
  return { members, months, names };
}

export function monthId(projectId: string, key: string): string {
  return uuidFrom(projectId + ':month:' + key);
}

/** Personnes concernées par un mois : actives + archivées encore présentes dans ce mois. */
export function monthMembers(month: RentMonthData | undefined, members: Item<RentMemberData>[]): string[] {
  return members
    .filter((m) => {
      if (!m.data.archived) return true;
      if (!month) return false;
      return (month.shares?.[m.id] ?? 0) > 0 || month.lines.some((l) => l.person === m.id || l.split?.includes(m.id));
    })
    .map((m) => m.id);
}

export function equalShares(ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const n = ids.length || 1;
  ids.forEach((id) => (out[id] = Math.round((100 / n) * 10) / 10));
  return out;
}

/** Nouveau mois à partir du précédent : mêmes lignes et parts, virements à refaire. */
export function copyMonth(projectId: string, key: string, from: RentMonthData | undefined, members: Item<RentMemberData>[]) {
  const active = members.filter((m) => !m.data.archived).map((m) => m.id);
  const fallback = active[0];
  const lines: RentLine[] = (from?.lines || []).map((l) => ({
    ...l,
    id: uuid(),
    person: active.includes(l.person) ? l.person : fallback,
    split: l.split ? l.split.filter((id) => active.includes(id)) : null,
  }));
  const shares: Record<string, number> = {};
  const src = from?.shares || {};
  const keep = active.filter((id) => (src[id] ?? 0) > 0);
  if (keep.length === active.length) for (const id of active) shares[id] = src[id];
  else Object.assign(shares, equalShares(active));
  const data: RentMonthData = { month: key, lines, shares, done: {}, note: '' };
  putItem(projectId, 'month', data, monthId(projectId, key));
}

export function selectHousehold(id: string) {
  setPrefs({ rentId: id });
}
