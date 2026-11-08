import { useState } from 'preact/hooks';
import { CurrencySelect } from '../../components/LogoPicker';
import { Receipts } from '../../components/receipts';
import { confirmDialog, toast } from '../../components/toast';
import { AmountInput, Empty, Field, Icon, PersonChips, Sheet, Switch } from '../../components/ui';
import { daysBetween, fmtDateTime, relativeDays, todayISO } from '../../lib/date';
import { fmt } from '../../lib/money';
import { copyText } from '../../lib/share';
import { deleteItem, itemsOf, putItem } from '../../lib/store';
import type { Item, LodgingData } from '../../lib/types';
import { type Group } from './common';
import { upsertLinkedExpense } from './linked';

export function LodgingTab({ g }: { g: Group }) {
  const [edit, setEdit] = useState<{ id?: string; data: LodgingData } | null>(null);
  const list = itemsOf<LodgingData>(g.p.id, 'lodging')
    .slice()
    .sort((a, b) => (a.data.checkIn || '9').localeCompare(b.data.checkIn || '9'));
  const blank = (): LodgingData => ({
    name: '',
    checkIn: g.p.data.startDate ? g.p.data.startDate + 'T16:00' : undefined,
    checkOut: g.p.data.endDate ? g.p.data.endDate + 'T11:00' : undefined,
    guests: g.people.map((p) => p.id),
    currency: g.p.data.currency,
    payer: g.me,
  });
  return (
    <>
      {!g.readOnly && (
        <button type="button" class="btn primary block" onClick={() => setEdit({ data: blank() })}>
          <Icon name="plus" size={18} /> Ajouter un hébergement
        </button>
      )}
      {!list.length && (
        <section class="panel">
          <Empty icon="🏨" title="Aucun hébergement">
            <p>Airbnb, hôtel, camping : adresse, horaires d’arrivée, code de réservation. Le prix peut créer la dépense automatiquement.</p>
          </Empty>
        </section>
      )}
      {list.map((l) => (
        <LodgingCard key={l.id} g={g} l={l} onEdit={() => setEdit({ id: l.id, data: { ...l.data } })} />
      ))}
      {edit && <LodgingSheet g={g} edit={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function LodgingCard({ g, l, onEdit }: { g: Group; l: Item<LodgingData>; onEdit: () => void }) {
  const d = l.data;
  const nights = d.checkIn && d.checkOut ? daysBetween(d.checkIn.slice(0, 10), d.checkOut.slice(0, 10)) : 0;
  return (
    <div class="card" role="button" tabIndex={0} onClick={onEdit} onKeyDown={(e) => e.key === 'Enter' && onEdit()}>
      <div class="row between">
        <h3>{d.name || 'Hébergement'}</h3>
        {d.checkIn && <span class="tag">{relativeDays(d.checkIn)}</span>}
      </div>
      <div class="meta-row">
        {d.checkIn && (
          <span>
            Arrivée <b>{fmtDateTime(d.checkIn)}</b>
          </span>
        )}
        {d.checkOut && (
          <span>
            Départ <b>{fmtDateTime(d.checkOut)}</b>
          </span>
        )}
        {nights > 0 && <span>{nights} nuit{nights > 1 ? 's' : ''}</span>}
      </div>
      {d.address && <p class="small">{d.address}</p>}
      <div class="meta-row">
        {d.reference && (
          <span>
            Réf. <b>{d.reference}</b>
          </span>
        )}
        {d.price ? (
          <span>
            <b>{fmt(d.price, d.currency || g.p.data.currency)}</b>
            {nights > 0 ? ` · ${fmt(Math.round(d.price / nights), d.currency || g.p.data.currency)}/nuit` : ''}
          </span>
        ) : null}
        {d.receipts?.length ? <span>📎 {d.receipts.length}</span> : null}
      </div>
      <div class="row gap wrap" onClick={(e) => e.stopPropagation()}>
        {d.address && (
          <a class="btn small soft" href={'https://maps.apple.com/?q=' + encodeURIComponent(d.address)} target="_blank" rel="noopener">
            <Icon name="pin" size={16} /> Itinéraire
          </a>
        )}
        {d.url && (
          <a class="btn small" href={d.url} target="_blank" rel="noopener">
            <Icon name="external" size={16} /> Réservation
          </a>
        )}
        {d.phone && (
          <a class="btn small" href={'tel:' + d.phone.replace(/\s/g, '')}>
            <Icon name="phone" size={16} /> Appeler
          </a>
        )}
        {d.reference && (
          <button type="button" class="btn small ghost" onClick={() => copyText(d.reference!, 'Référence copiée')}>
            <Icon name="copy" size={16} /> Réf.
          </button>
        )}
      </div>
    </div>
  );
}

function LodgingSheet({ g, edit, onClose }: { g: Group; edit: { id?: string; data: LodgingData }; onClose: () => void }) {
  const [d, setD] = useState<LodgingData>(edit.data);
  const [asExpense, setAsExpense] = useState(edit.id ? !!edit.data.expenseId : true);
  const set = (p: Partial<LodgingData>) => setD({ ...d, ...p });
  const ro = g.readOnly;

  async function save() {
    if (!d.name.trim()) return toast('Donne un nom à l’hébergement', { tone: 'warn' });
    if (d.url && !/^https?:\/\//i.test(d.url)) d.url = 'https://' + d.url;
    const id = putItem<LodgingData>(g.p.id, 'lodging', d, edit.id);
    const expenseId = await upsertLinkedExpense(g, { type: 'lodging', id }, {
      enabled: asExpense,
      expenseId: d.expenseId,
      title: '🏨 ' + d.name,
      amount: d.price,
      currency: d.currency,
      payer: d.payer,
      participants: d.guests,
      category: 'lodging',
      date: d.checkIn?.slice(0, 10) || todayISO(),
    });
    if (expenseId !== d.expenseId) putItem<LodgingData>(g.p.id, 'lodging', { ...d, expenseId }, id);
    toast(edit.id ? 'Hébergement modifié' : 'Hébergement ajouté');
    onClose();
  }

  async function remove() {
    if (!edit.id) return;
    if (!(await confirmDialog({ title: 'Supprimer cet hébergement ?', message: d.expenseId ? 'La dépense liée sera supprimée aussi.' : undefined, confirm: 'Supprimer', danger: true }))) return;
    if (d.expenseId) deleteItem(d.expenseId);
    deleteItem(edit.id);
    onClose();
  }

  return (
    <Sheet open title={edit.id ? 'Hébergement' : 'Nouvel hébergement'} onClose={onClose} onSave={ro ? undefined : save} saveLabel="Enregistrer">
      <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0, display: 'contents' }}>
        <Field label="Nom">
          <input type="text" placeholder="Appartement Alfama" value={d.name} onInput={(e) => set({ name: e.currentTarget.value })} />
        </Field>
        <Field label="Adresse">
          <input type="text" value={d.address || ''} onInput={(e) => set({ address: e.currentTarget.value })} />
        </Field>
        <Field label="Arrivée">
          <input type="datetime-local" value={d.checkIn || ''} onInput={(e) => set({ checkIn: e.currentTarget.value || undefined })} />
        </Field>
        <Field label="Départ">
          <input type="datetime-local" value={d.checkOut || ''} min={d.checkIn} onInput={(e) => set({ checkOut: e.currentTarget.value || undefined })} />
        </Field>
        <div class="grid2">
          <Field label="Réf. réservation">
            <input type="text" value={d.reference || ''} onInput={(e) => set({ reference: e.currentTarget.value })} />
          </Field>
          <Field label="Téléphone">
            <input type="tel" value={d.phone || ''} onInput={(e) => set({ phone: e.currentTarget.value })} />
          </Field>
        </div>
        <Field label="Lien de la réservation">
          <input type="url" placeholder="https://…" value={d.url || ''} onInput={(e) => set({ url: e.currentTarget.value })} />
        </Field>
        <Field label="Qui dort là">
          <PersonChips multi people={g.people} value={d.guests} me={g.me} onChange={(guests: string[]) => set({ guests })} />
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
          <Switch checked={asExpense} onChange={setAsExpense} label="Ajouter aux dépenses" hint="Réparti à parts égales entre les personnes qui dorment là." />
          {asExpense && (
            <Field label="Payé par">
              <PersonChips people={g.people} value={d.payer || ''} me={g.me} onChange={(payer: string) => set({ payer })} />
            </Field>
          )}
        </div>
        <Field label="Documents">
          <Receipts projectId={g.p.id} ids={d.receipts || []} readOnly={ro} onChange={(receipts) => set({ receipts })} label="Photo" />
        </Field>
        <Field label="Note">
          <textarea value={d.note || ''} placeholder="Code de la boîte à clés, wifi…" onInput={(e) => set({ note: e.currentTarget.value })} />
        </Field>
      </fieldset>
      {edit.id && !ro && (
        <button type="button" class="btn danger block" onClick={remove}>
          <Icon name="trash" size={18} /> Supprimer
        </button>
      )}
    </Sheet>
  );
}
