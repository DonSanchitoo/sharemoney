import { useState } from 'preact/hooks';
import { confirmDialog, toast } from '../../components/toast';
import { AmountInput, Empty, Field, Icon, PersonChips, Segmented, Sheet } from '../../components/ui';
import { addDays, fmtDate, monthKey, todayISO } from '../../lib/date';
import { fmt } from '../../lib/money';
import { deleteItem, itemsOf, patchItem, putItem } from '../../lib/store';
import type { ExpenseData, Item, RecurringData } from '../../lib/types';
import { categoryOf, memberName, type Group } from './common';

function isDue(r: RecurringData): boolean {
  if (!r.lastAdded) return true;
  if (r.frequency === 'weekly') return r.lastAdded <= addDays(todayISO(), -7);
  return r.lastAdded.slice(0, 7) < monthKey();
}

export function RecurringTab({ g }: { g: Group }) {
  const [edit, setEdit] = useState<{ id?: string; data: RecurringData } | null>(null);
  const list = itemsOf<RecurringData>(g.p.id, 'recurring')
    .slice()
    .sort((a, b) => a.data.title.localeCompare(b.data.title, 'fr'));
  const cur = g.p.data.currency;
  const due = list.filter((r) => isDue(r.data));

  function addNow(r: Item<RecurringData>) {
    const parts = Object.fromEntries((r.data.participants?.length ? r.data.participants : g.people.map((p) => p.id)).map((id) => [id, 1]));
    putItem<ExpenseData>(g.p.id, 'expense', {
      kind: 'expense',
      title: r.data.title,
      amount: r.data.amount,
      currency: cur,
      rate: 1,
      payer: r.data.payer,
      date: todayISO(),
      category: r.data.category || 'other',
      split: { mode: 'equal', parts },
      link: { type: 'recurring', id: r.id },
      createdBy: g.me,
    });
    patchItem<RecurringData>(r.id, { lastAdded: todayISO() });
    toast(`« ${r.data.title} » ajouté aux dépenses`);
  }

  const blank = (): RecurringData => ({ title: '', amount: 0, payer: g.me || g.people[0]?.id || '', frequency: 'monthly', category: g.p.data.categories[0]?.id });

  return (
    <>
      {!g.readOnly && (
        <button type="button" class="btn primary block" onClick={() => setEdit({ data: blank() })}>
          <Icon name="plus" size={18} /> Nouvelle dépense récurrente
        </button>
      )}
      {due.length > 1 && !g.readOnly && (
        <button type="button" class="btn soft block" onClick={() => due.forEach(addNow)}>
          Ajouter les {due.length} dépenses dues
        </button>
      )}
      {!list.length ? (
        <section class="panel">
          <Empty icon="🔁" title="Aucune dépense récurrente">
            <p>Abonnements, internet, ménage, terrain du jeudi : enregistre-les une fois, ajoute-les en un geste chaque mois.</p>
          </Empty>
        </section>
      ) : (
        <section class="panel flush">
          {list.map((r) => {
            const c = categoryOf(g.p, r.data.category);
            const isdue = isDue(r.data);
            return (
              <div class="li" key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                <span class="cat-icon">{c.icon}</span>
                <button type="button" class="li-main" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => setEdit({ id: r.id, data: { ...r.data } })}>
                  <div class="li-title">{r.data.title}</div>
                  <div class="li-sub">
                    {fmt(r.data.amount, cur)} · {r.data.frequency === 'weekly' ? 'chaque semaine' : 'chaque mois'} · {memberName(g.names, r.data.payer, g.me)}
                    {r.data.lastAdded ? ` · dernier ${fmtDate(r.data.lastAdded, { day: 'numeric', month: 'short' })}` : ''}
                  </div>
                </button>
                {!g.readOnly &&
                  (isdue ? (
                    <button type="button" class="btn small primary" onClick={() => addNow(r)}>
                      Ajouter
                    </button>
                  ) : (
                    <span class="tag ok">À jour</span>
                  ))}
              </div>
            );
          })}
        </section>
      )}
      {edit && <RecurringSheet g={g} edit={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function RecurringSheet({ g, edit, onClose }: { g: Group; edit: { id?: string; data: RecurringData }; onClose: () => void }) {
  const [d, setD] = useState<RecurringData>(edit.data);
  const set = (p: Partial<RecurringData>) => setD({ ...d, ...p });
  const parts = d.participants?.length ? d.participants : g.people.map((p) => p.id);
  function save() {
    if (!d.title.trim() || !d.amount) return toast('Titre et montant requis', { tone: 'warn' });
    putItem<RecurringData>(g.p.id, 'recurring', d, edit.id);
    onClose();
  }
  async function remove() {
    if (!edit.id || !(await confirmDialog({ title: 'Supprimer ce modèle ?', message: 'Les dépenses déjà ajoutées restent.', confirm: 'Supprimer', danger: true }))) return;
    deleteItem(edit.id);
    onClose();
  }
  return (
    <Sheet open title={edit.id ? 'Récurrente' : 'Nouvelle récurrente'} onClose={onClose} onSave={g.readOnly ? undefined : save} saveLabel="Enregistrer">
      <Field label="Titre">
        <input type="text" placeholder="Box internet" value={d.title} onInput={(e) => set({ title: e.currentTarget.value })} />
      </Field>
      <Field label="Montant">
        <AmountInput value={d.amount} currency={g.p.data.currency} onValue={(amount) => set({ amount })} />
      </Field>
      <Segmented
        value={d.frequency}
        options={[
          { value: 'monthly', label: 'Chaque mois' },
          { value: 'weekly', label: 'Chaque semaine' },
        ]}
        onChange={(frequency) => set({ frequency })}
      />
      <Field label="Payé par">
        <PersonChips people={g.people} value={d.payer} me={g.me} onChange={(payer: string) => set({ payer })} />
      </Field>
      <Field label="Pour qui (parts égales)">
        <PersonChips multi people={g.people} value={parts} me={g.me} onChange={(participants: string[]) => set({ participants })} />
      </Field>
      <div class="chips">
        {g.p.data.categories.map((c) => (
          <button type="button" key={c.id} class={'chip' + (d.category === c.id ? ' on' : '')} onClick={() => set({ category: c.id })}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      {edit.id && !g.readOnly && (
        <button type="button" class="btn danger block" onClick={remove}>
          <Icon name="trash" size={18} /> Supprimer le modèle
        </button>
      )}
    </Sheet>
  );
}
