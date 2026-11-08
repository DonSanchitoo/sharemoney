const pad = (n: number) => String(n).padStart(2, '0');

export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const out = new Date(y, (m || 1) - 1, d || 1);
  if (iso.length > 10) {
    const [hh, mm] = iso.slice(11, 16).split(':').map(Number);
    out.setHours(hh || 0, mm || 0);
  }
  return out;
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function monthLabel(key: string, short = false): string {
  const [y, m] = key.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', short ? { month: 'short', year: '2-digit' } : { month: 'long', year: 'numeric' });
  return cap(s);
}

export function fmtDate(iso: string | undefined, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  if (!iso) return '';
  return parseISO(iso).toLocaleDateString('fr-FR', opts);
}

export function fmtDayTitle(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Aujourd'hui";
  if (iso === addDays(today, -1)) return 'Hier';
  if (iso === addDays(today, 1)) return 'Demain';
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return cap(fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }));
}

export function fmtTime(iso: string | undefined): string {
  if (!iso || iso.length < 16) return '';
  return iso.slice(11, 16).replace(':', 'h');
}

export function fmtDateTime(iso: string | undefined): string {
  if (!iso) return '';
  const t = fmtTime(iso);
  return fmtDate(iso) + (t ? ' · ' + t : '');
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function fmtRange(start?: string, end?: string): string {
  if (!start) return '';
  if (!end || end === start) return fmtDate(start, { day: 'numeric', month: 'short', year: 'numeric' });
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const a = fmtDate(start, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const b = fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${a} – ${b}`;
}

export function relativeDays(iso: string): string {
  const n = daysBetween(todayISO(), iso.slice(0, 10));
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  return n > 0 ? `dans ${n} j` : `il y a ${-n} j`;
}

export function fmtAgo(ts: number | undefined): string {
  if (!ts) return 'jamais';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return "à l'instant";
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return new Date(ts).toLocaleDateString('fr-FR');
}
