import { useState } from 'preact/hooks';
import { confirmDialog, toast } from '../../components/toast';
import { Empty, Field, Icon, Sheet } from '../../components/ui';
import { daysBetween, fmtDayTitle, fmtTime, todayISO } from '../../lib/date';
import { TICKET_MODES } from '../../lib/presets';
import { deleteItem, itemsOf, putItem } from '../../lib/store';
import type { LodgingData, PlanData, TicketData } from '../../lib/types';
import { type Group } from './common';

interface Entry {
  key: string;
  date: string;
  time?: string;
  title: string;
  sub?: string;
  icon: string;
  editId?: string;
}

export function PlanTab({ g }: { g: Group }) {
  const [edit, setEdit] = useState<{ id?: string; data: PlanData } | null>(null);
  const plans = itemsOf<PlanData>(g.p.id, 'plan');
  const entries: Entry[] = plans.map((p) => ({
    key: p.id,
    date: p.data.date,
    time: p.data.time,
    title: p.data.title,
    sub: [p.data.place, p.data.note].filter(Boolean).join(' · '),
    icon: '📍',
    editId: p.id,
  }));
  // Les billets et hébergements apparaissent aussi dans le programme.
  if (g.p.data.modules.tickets) {
    for (const t of itemsOf<TicketData>(g.p.id, 'ticket')) {
      if (!t.data.departure) continue;
      entries.push({
        key: 't' + t.id,
        date: t.data.departure.slice(0, 10),
        time: t.data.departure.slice(11, 16),
        title: `${t.data.from} → ${t.data.to}`,
        sub: [t.data.carrier, t.data.number, t.data.reference && 'réf. ' + t.data.reference].filter(Boolean).join(' · '),
        icon: TICKET_MODES.find((m) => m.mode === t.data.mode)?.icon || '🎫',
      });
    }
  }
  if (g.p.data.modules.lodging) {
    for (const l of itemsOf<LodgingData>(g.p.id, 'lodging')) {
      if (l.data.checkIn) entries.push({ key: 'li' + l.id, date: l.data.checkIn.slice(0, 10), time: l.data.checkIn.slice(11, 16), title: `Arrivée · ${l.data.name}`, sub: l.data.address, icon: '🔑' });
      if (l.data.checkOut) entries.push({ key: 'lo' + l.id, date: l.data.checkOut.slice(0, 10), time: l.data.checkOut.slice(11, 16), title: `Départ · ${l.data.name}`, icon: '🧳' });
    }
  }
  entries.sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
  const days: { date: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const last = days[days.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else days.push({ date: e.date, items: [e] });
  }
  const start = g.p.data.startDate;
  const blank = (date?: string): PlanData => ({ date: date || (start && start > todayISO() ? start : todayISO()), title: '' });

  return (
    <>
      {!g.readOnly && (
        <button type="button" class="btn primary block" onClick={() => setEdit({ data: blank() })}>
          <Icon name="plus" size={18} /> Ajouter au programme
        </button>
      )}
      {!days.length && (
        <section class="panel">
          <Empty icon="🗓️" title="Programme vide">
            <p>Visites, restos réservés, activités : tout le monde voit le planning jour par jour.</p>
          </Empty>
        </section>
      )}
      {days.map((d) => (
        <section class="panel flush" key={d.date}>
          <div class="day-head row between">
            <span>{fmtDayTitle(d.date)}</span>
            {start && d.date >= start && <span>Jour {daysBetween(start, d.date) + 1}</span>}
          </div>
          {d.items.map((e) => (
            <button
              type="button"
              key={e.key}
              class="timeline-item"
              style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', borderTop: '1px solid var(--line)' }}
              onClick={() => {
                if (e.editId) {
                  const p = plans.find((x) => x.id === e.editId);
                  if (p) setEdit({ id: p.id, data: { ...p.data } });
                }
              }}
            >
              <span class="t">{fmtTime(e.date + 'T' + (e.time || '')) || '—'}</span>
              <span>
                <span class="li-title" style={{ display: 'block', whiteSpace: 'normal' }}>
                  {e.icon} {e.title}
                </span>
                {e.sub && <span class="li-sub" style={{ display: 'block', whiteSpace: 'normal' }}>{e.sub}</span>}
              </span>
            </button>
          ))}
        </section>
      ))}
      {edit && <PlanSheet g={g} edit={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function PlanSheet({ g, edit, onClose }: { g: Group; edit: { id?: string; data: PlanData }; onClose: () => void }) {
  const [d, setD] = useState<PlanData>(edit.data);
  const set = (p: Partial<PlanData>) => setD({ ...d, ...p });
  function save() {
    if (!d.title.trim()) return toast('Donne un titre', { tone: 'warn' });
    putItem<PlanData>(g.p.id, 'plan', d, edit.id);
    onClose();
  }
  async function remove() {
    if (!edit.id || !(await confirmDialog({ title: 'Retirer du programme ?', confirm: 'Retirer', danger: true }))) return;
    deleteItem(edit.id);
    onClose();
  }
  return (
    <Sheet open title={edit.id ? 'Activité' : 'Nouvelle activité'} onClose={onClose} onSave={g.readOnly ? undefined : save} saveLabel="Enregistrer">
      <Field label="Quoi">
        <input type="text" placeholder="Visite du château, resto…" value={d.title} onInput={(e) => set({ title: e.currentTarget.value })} />
      </Field>
      <div class="grid2">
        <Field label="Jour">
          <input type="date" value={d.date} onInput={(e) => set({ date: e.currentTarget.value || todayISO() })} />
        </Field>
        <Field label="Heure">
          <input type="time" value={d.time || ''} onInput={(e) => set({ time: e.currentTarget.value || undefined })} />
        </Field>
      </div>
      <Field label="Lieu">
        <input type="text" value={d.place || ''} onInput={(e) => set({ place: e.currentTarget.value })} />
      </Field>
      <Field label="Note">
        <textarea value={d.note || ''} onInput={(e) => set({ note: e.currentTarget.value })} />
      </Field>
      {edit.id && !g.readOnly && (
        <button type="button" class="btn danger block" onClick={remove}>
          <Icon name="trash" size={18} /> Retirer
        </button>
      )}
    </Sheet>
  );
}
