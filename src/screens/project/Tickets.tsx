import { useState } from 'preact/hooks';
import { CurrencySelect } from '../../components/LogoPicker';
import { Receipts } from '../../components/receipts';
import { confirmDialog, toast } from '../../components/toast';
import { AmountInput, Avatar, Empty, Field, Icon, PersonChips, Sheet, Switch } from '../../components/ui';
import { fmtDateTime, fmtTime, relativeDays, todayISO } from '../../lib/date';
import { fmt } from '../../lib/money';
import { TICKET_MODES } from '../../lib/presets';
import { copyText } from '../../lib/share';
import { deleteItem, itemsOf, putItem } from '../../lib/store';
import type { Item, TicketData } from '../../lib/types';
import { memberName, type Group } from './common';
import { upsertLinkedExpense } from './linked';

const icon = (m: TicketData['mode']) => TICKET_MODES.find((x) => x.mode === m)?.icon || '🎫';

export function TicketsTab({ g }: { g: Group }) {
  const [edit, setEdit] = useState<{ id?: string; data: TicketData } | null>(null);
  const tickets = itemsOf<TicketData>(g.p.id, 'ticket')
    .slice()
    .sort((a, b) => (a.data.departure || '9').localeCompare(b.data.departure || '9'));
  const now = new Date().toISOString().slice(0, 16);
  const upcoming = tickets.filter((t) => !t.data.departure || t.data.departure >= now.slice(0, 10));
  const past = tickets.filter((t) => t.data.departure && t.data.departure < now.slice(0, 10));

  const blank = (): TicketData => ({
    mode: 'plane',
    from: '',
    to: '',
    departure: g.p.data.startDate ? g.p.data.startDate + 'T08:00' : undefined,
    passengers: g.people.map((p) => p.id),
    currency: g.p.data.currency,
    payer: g.me,
  });

  return (
    <>
      {!g.readOnly && (
        <button type="button" class="btn primary block" onClick={() => setEdit({ data: blank() })}>
          <Icon name="plus" size={18} /> Ajouter un billet
        </button>
      )}
      {!tickets.length && (
        <section class="panel">
          <Empty icon="🎫" title="Aucun billet">
            <p>Vols, trains, bus, ferries : horaires, références de réservation et passagers au même endroit. Le prix peut créer la dépense automatiquement.</p>
          </Empty>
        </section>
      )}
      {upcoming.map((t) => (
        <TicketCard key={t.id} g={g} t={t} onEdit={() => setEdit({ id: t.id, data: { ...t.data } })} />
      ))}
      {past.length > 0 && (
        <details>
          <summary>Billets passés ({past.length})</summary>
          <div class="stack" style={{ marginTop: 12 }}>
            {past.map((t) => (
              <TicketCard key={t.id} g={g} t={t} onEdit={() => setEdit({ id: t.id, data: { ...t.data } })} />
            ))}
          </div>
        </details>
      )}
      {edit && <TicketSheet g={g} edit={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function TicketCard({ g, t, onEdit }: { g: Group; t: Item<TicketData>; onEdit: () => void }) {
  const d = t.data;
  return (
    <div class="card" role="button" tabIndex={0} onClick={onEdit} onKeyDown={(e) => e.key === 'Enter' && onEdit()}>
      <div class="row between">
        <span class="small muted">
          {icon(d.mode)} {[d.carrier, d.number].filter(Boolean).join(' ') || TICKET_MODES.find((x) => x.mode === d.mode)?.label}
        </span>
        {d.departure && <span class="tag">{relativeDays(d.departure)}</span>}
      </div>
      <div class="ticket-route">
        <div>
          <div class="place">{d.from || '?'}</div>
          <div class="time">{fmtDateTime(d.departure)}</div>
        </div>
        <span class="mid" aria-hidden="true">
          →
        </span>
        <div>
          <div class="place end">{d.to || '?'}</div>
          <div class="time" style={{ textAlign: 'right' }}>
            {d.arrival ? (d.arrival.slice(0, 10) === d.departure?.slice(0, 10) ? fmtTime(d.arrival) : fmtDateTime(d.arrival)) : ''}
          </div>
        </div>
      </div>
      <div class="meta-row">
        {d.reference && (
          <span>
            Réf. <b>{d.reference}</b>{' '}
            <button
              type="button"
              class="link-btn"
              style={{ padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                void copyText(d.reference!, 'Référence copiée');
              }}
            >
              copier
            </button>
          </span>
        )}
        {d.seat && (
          <span>
            Place <b>{d.seat}</b>
          </span>
        )}
        {d.price ? (
          <span>
            <b>{fmt(d.price, d.currency || g.p.data.currency)}</b>
            {d.expenseId ? ' · en dépense' : ''}
          </span>
        ) : null}
        {d.receipts?.length ? <span>📎 {d.receipts.length}</span> : null}
      </div>
      {d.passengers.length > 0 && (
        <div class="row gap">
          <div class="avatars">
            {d.passengers.slice(0, 8).map((id) => (
              <Avatar key={id} name={g.names[id] || '?'} id={id} size={24} />
            ))}
          </div>
          <span class="small muted ellipsis">{d.passengers.map((id) => memberName(g.names, id, g.me)).join(', ')}</span>
        </div>
      )}
    </div>
  );
}

function TicketSheet({ g, edit, onClose }: { g: Group; edit: { id?: string; data: TicketData }; onClose: () => void }) {
  const [d, setD] = useState<TicketData>(edit.data);
  const [asExpense, setAsExpense] = useState(edit.id ? !!edit.data.expenseId : true);
  const set = (p: Partial<TicketData>) => setD({ ...d, ...p });
  const ro = g.readOnly;

  async function save() {
    if (!d.from.trim() && !d.to.trim()) return toast('Indique au moins le départ ou l’arrivée', { tone: 'warn' });
    const id = putItem<TicketData>(g.p.id, 'ticket', d, edit.id);
    const label = `${icon(d.mode)} ${d.from || '?'} → ${d.to || '?'}`;
    const expenseId = await upsertLinkedExpense(g, { type: 'ticket', id }, {
      enabled: asExpense,
      expenseId: d.expenseId,
      title: label,
      amount: d.price,
      currency: d.currency,
      payer: d.payer,
      participants: d.passengers,
      category: d.mode === 'plane' ? 'flight' : 'transport',
      date: d.departure?.slice(0, 10) || todayISO(),
    });
    if (expenseId !== d.expenseId) putItem<TicketData>(g.p.id, 'ticket', { ...d, expenseId }, id);
    toast(edit.id ? 'Billet modifié' : 'Billet ajouté');
    onClose();
  }

  async function remove() {
    if (!edit.id) return;
    if (!(await confirmDialog({ title: 'Supprimer ce billet ?', message: d.expenseId ? 'La dépense liée sera supprimée aussi.' : undefined, confirm: 'Supprimer', danger: true }))) return;
    if (d.expenseId) deleteItem(d.expenseId);
    deleteItem(edit.id);
    onClose();
  }

  return (
    <Sheet open title={edit.id ? 'Billet' : 'Nouveau billet'} onClose={onClose} onSave={ro ? undefined : save} saveLabel="Enregistrer">
      <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0, display: 'contents' }}>
        <div class="chips">
          {TICKET_MODES.map((m) => (
            <button type="button" key={m.mode} class={'chip' + (d.mode === m.mode ? ' on' : '')} onClick={() => set({ mode: m.mode })}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
        <div class="grid2">
          <Field label="Départ">
            <input type="text" placeholder="Paris CDG" value={d.from} onInput={(e) => set({ from: e.currentTarget.value })} />
          </Field>
          <Field label="Arrivée">
            <input type="text" placeholder="Lisbonne" value={d.to} onInput={(e) => set({ to: e.currentTarget.value })} />
          </Field>
        </div>
        <Field label="Date et heure de départ">
          <input type="datetime-local" value={d.departure || ''} onInput={(e) => set({ departure: e.currentTarget.value || undefined })} />
        </Field>
        <Field label="Arrivée prévue">
          <input type="datetime-local" value={d.arrival || ''} min={d.departure} onInput={(e) => set({ arrival: e.currentTarget.value || undefined })} />
        </Field>
        <div class="grid2">
          <Field label="Compagnie">
            <input type="text" placeholder="TAP, SNCF…" value={d.carrier || ''} onInput={(e) => set({ carrier: e.currentTarget.value })} />
          </Field>
          <Field label="N° vol / train">
            <input type="text" placeholder="TP433" value={d.number || ''} onInput={(e) => set({ number: e.currentTarget.value })} />
          </Field>
        </div>
        <div class="grid2">
          <Field label="Réf. réservation">
            <input type="text" autoCapitalize="characters" value={d.reference || ''} onInput={(e) => set({ reference: e.currentTarget.value })} />
          </Field>
          <Field label="Place(s)">
            <input type="text" value={d.seat || ''} onInput={(e) => set({ seat: e.currentTarget.value })} />
          </Field>
        </div>
        <Field label="Passagers">
          <PersonChips multi people={g.people} value={d.passengers} me={g.me} onChange={(passengers: string[]) => set({ passengers })} />
        </Field>
        <div class="panel" style={{ padding: 12 }}>
          <div class="grid2">
            <Field label="Prix total">
              <AmountInput value={d.price || 0} currency={d.currency || g.p.data.currency} onValue={(price) => set({ price })} />
            </Field>
            {g.p.data.modules.multiCurrency && (
              <Field label="Devise">
                <CurrencySelect value={d.currency || g.p.data.currency} onChange={(currency) => set({ currency })} />
              </Field>
            )}
          </div>
          <Switch checked={asExpense} onChange={setAsExpense} label="Ajouter aux dépenses" hint="Réparti à parts égales entre les passagers." />
          {asExpense && (
            <Field label="Payé par">
              <PersonChips people={g.people} value={d.payer || ''} me={g.me} onChange={(payer: string) => set({ payer })} />
            </Field>
          )}
        </div>
        <Field label="Billets / cartes d’embarquement">
          <Receipts projectId={g.p.id} ids={d.receipts || []} readOnly={ro} onChange={(receipts) => set({ receipts })} label="Photo" />
        </Field>
        <Field label="Note">
          <textarea value={d.note || ''} placeholder="Bagages, terminal, porte…" onInput={(e) => set({ note: e.currentTarget.value })} />
        </Field>
      </fieldset>
      {edit.id && !ro && (
        <button type="button" class="btn danger block" onClick={remove}>
          <Icon name="trash" size={18} /> Supprimer le billet
        </button>
      )}
    </Sheet>
  );
}
