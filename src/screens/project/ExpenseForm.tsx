import { useEffect, useMemo, useState } from 'preact/hooks';
import { CurrencySelect } from '../../components/LogoPicker';
import { Receipts } from '../../components/receipts';
import { confirmDialog, toast } from '../../components/toast';
import { AmountInput, Avatar, Empty, Field, Icon, NumberInput, PersonChips, Segmented, TopBar } from '../../components/ui';
import { baseAmount, computeBalances, defaultSplit, splitError, splitShares } from '../../lib/calc';
import { fmtAgo, todayISO } from '../../lib/date';
import { getRate } from '../../lib/fx';
import { guessCategory } from '../../lib/guess';
import { distribute, fmt } from '../../lib/money';
import { back } from '../../lib/router';
import { db, deleteItem, patchItem, putItem, setPrefs, updateProject } from '../../lib/store';
import type { ExpenseData, ExpenseKind, GroupData, SplitMode } from '../../lib/types';
import { budgetAlerts } from './budget';
import { useGroup, type Group } from './common';

export function ExpenseForm({ projectId, expenseId }: { projectId: string; expenseId?: string }) {
  const g = useGroup(projectId);
  if (!g.p) return <Empty icon="🔍" title="Projet introuvable" />;
  const existing = expenseId && expenseId !== 'new' ? db.value.items[expenseId] : undefined;
  if (expenseId !== 'new' && (!existing || existing.deleted)) {
    return (
      <div class="page has-topbar">
        <TopBar onBack={() => back('p/' + projectId)} />
        <Empty icon="🔍" title="Dépense introuvable" />
      </div>
    );
  }
  return <Form g={g as Group} id={existing?.id} initial={existing?.data as ExpenseData | undefined} />;
}

function newExpense(g: Group): ExpenseData {
  const d = g.p.data;
  const people = g.people.map((p) => p.id);
  return {
    kind: 'expense',
    title: '',
    amount: 0,
    currency: (d.modules.multiCurrency && db.value.prefs.lastCurrency?.[g.p.id]) || d.currency,
    rate: 1,
    payer: g.me && people.includes(g.me) ? g.me : people[0] || '',
    date: todayISO(),
    split: defaultSplit(g.members),
  };
}

function Form({ g, id, initial }: { g: Group; id?: string; initial?: ExpenseData }) {
  const d = g.p.data;
  const [e, setE] = useState<ExpenseData>(() => initial ? { ...initial, split: { ...initial.split, parts: { ...initial.split.parts } } } : newExpense(g));
  const [catTouched, setCatTouched] = useState(!!initial?.category);
  const [fx, setFx] = useState<{ loading: boolean; at?: number; failed?: boolean }>({ loading: false });
  const set = (patch: Partial<ExpenseData>) => setE((cur) => ({ ...cur, ...patch }));
  const readOnly = g.readOnly;
  const base = d.currency;
  const showCurrency = d.modules.multiCurrency || e.currency !== base;
  const catIds = d.categories.map((c) => c.id);

  // Taux de change automatique quand la devise change.
  useEffect(() => {
    if (e.currency === base) {
      if (e.rate !== 1) set({ rate: 1 });
      return;
    }
    if (initial && initial.currency === e.currency && initial.rate) return;
    let alive = true;
    setFx({ loading: true });
    getRate(e.currency, base).then((r) => {
      if (!alive) return;
      if (r) {
        set({ rate: Math.round(r.rate * 1e6) / 1e6 });
        setFx({ loading: false, at: r.at });
      } else setFx({ loading: false, failed: true });
    });
    return () => {
      alive = false;
    };
  }, [e.currency]);

  // Personnes affichées dans la répartition : actives + anciennes déjà concernées.
  const splitPeople = g.allPeople.filter((p) => g.people.some((x) => x.id === p.id) || (e.split.parts[p.id] ?? 0) > 0);
  const total = e.amount;
  const converted = baseAmount(e);
  const shares = useMemo(() => splitShares(converted, e.split), [converted, e.split]);
  const error = e.kind === 'transfer' ? null : total > 0 ? splitError(total, e.split) : null;

  function equalPercents(ids: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    const n = ids.length;
    if (!n) return out;
    const each = Math.floor(10000 / n) / 100;
    ids.forEach((k, i) => (out[k] = i === n - 1 ? Math.round((100 - each * (n - 1)) * 100) / 100 : each));
    return out;
  }

  function partsFor(mode: SplitMode, ids: string[]): Record<string, number> {
    const parts: Record<string, number> = {};
    if (mode === 'equal') ids.forEach((k) => (parts[k] = 1));
    if (mode === 'shares') ids.forEach((k) => (parts[k] = g.members.find((m) => m.id === k)?.data.weight ?? 1));
    if (mode === 'amounts') Object.assign(parts, distribute(total, Object.fromEntries(ids.map((k) => [k, 1]))));
    if (mode === 'percent') Object.assign(parts, equalPercents(ids));
    return parts;
  }

  function setMode(mode: SplitMode) {
    const included = Object.keys(e.split.parts).filter((k) => e.split.parts[k] > 0);
    const ids = included.length ? included : g.people.map((p) => p.id);
    set({ split: { mode, parts: partsFor(mode, ids) } });
  }

  function isOn(pid: string): boolean {
    return e.split.mode === 'amounts' ? pid in e.split.parts : (e.split.parts[pid] ?? 0) > 0;
  }

  function toggle(pid: string) {
    const parts = { ...e.split.parts };
    if (isOn(pid)) delete parts[pid];
    else parts[pid] = e.split.mode === 'shares' ? g.members.find((m) => m.id === pid)?.data.weight ?? 1 : e.split.mode === 'amounts' ? 0 : 1;
    if (e.split.mode === 'percent') Object.assign(parts, equalPercents(Object.keys(parts).filter((k) => parts[k] > 0)));
    set({ split: { ...e.split, parts } });
  }

  function setAll(on: boolean) {
    set({ split: { ...e.split, parts: on ? partsFor(e.split.mode, g.people.map((p) => p.id)) : {} } });
  }

  function save() {
    if (!(e.amount > 0)) return toast('Indique un montant', { tone: 'warn' });
    if (!e.payer) return toast('Choisis qui a payé', { tone: 'warn' });
    if (e.kind === 'transfer' && (!e.to || e.to === e.payer)) return toast('Choisis à qui va le remboursement', { tone: 'warn' });
    if (e.kind !== 'transfer' && error) return toast(error, { tone: 'warn' });
    const data: ExpenseData = {
      ...e,
      title: e.title.trim() || (e.kind === 'transfer' ? 'Remboursement' : e.kind === 'income' ? 'Rentrée d’argent' : 'Dépense'),
      category: e.kind === 'expense' ? e.category || 'other' : undefined,
      split: e.kind === 'transfer' ? { mode: 'equal', parts: {} } : e.split,
      createdBy: e.createdBy || g.me,
    };
    const before = budgetAlerts(g);
    const savedId = putItem<ExpenseData>(g.p.id, 'expense', data, id);
    if (d.modules.multiCurrency) setPrefs({ lastCurrency: { ...db.value.prefs.lastCurrency, [g.p.id]: e.currency } });
    // Alerte budget : seulement si cette saisie franchit un nouveau seuil.
    if (d.modules.budget && data.kind === 'expense') {
      const list = [...g.expenses.filter((x) => x.id !== savedId), { id: savedId, projectId: g.p.id, type: 'expense', data }];
      const r = computeBalances(list, g.members.map((m) => m.id));
      const after = budgetAlerts(g, r.byCategory, r.total);
      const fresh = after.find((a) => !before.some((b) => b.key === a.key && b.level === a.level));
      if (fresh) toast(fresh.text, { tone: fresh.level === 'over' ? 'error' : 'warn', ms: 6000 });
      else toast(id ? 'Dépense modifiée' : 'Dépense ajoutée');
    } else toast(id ? 'Modifié' : 'Ajouté');
    back('p/' + g.p.id);
  }

  async function remove() {
    if (!id) return;
    if (!(await confirmDialog({ title: 'Supprimer cette dépense ?', confirm: 'Supprimer', danger: true }))) return;
    if (e.link?.id && db.value.items[e.link.id]) patchItem(e.link.id, { expenseId: undefined });
    deleteItem(id);
    toast('Supprimé', { action: { label: 'Annuler', fn: () => putItem(g.p.id, 'expense', e, id) } });
    back('p/' + g.p.id);
  }

  const kindLabel = e.kind === 'transfer' ? 'Remboursement' : e.kind === 'income' ? 'Rentrée' : 'Dépense';
  const people = g.people;

  return (
    <div class="page has-topbar">
      <TopBar
        onBack={() => back('p/' + g.p.id)}
        backLabel="Annuler"
        title={id ? kindLabel : 'Nouvelle ' + kindLabel.toLowerCase()}
        actions={!readOnly && <button type="button" class="link-btn strong" onClick={save}>{id ? 'Enregistrer' : 'Ajouter'}</button>}
      />
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: 'contents' }}>
        <Segmented<ExpenseKind>
          value={e.kind}
          label="Type d'opération"
          options={[
            { value: 'expense', label: 'Dépense' },
            { value: 'transfer', label: 'Remboursement' },
            { value: 'income', label: 'Rentrée' },
          ]}
          onChange={(kind) => set({ kind, to: kind === 'transfer' ? e.to || people.find((p) => p.id !== e.payer)?.id : undefined })}
        />

        <section class="panel">
          {e.kind !== 'transfer' && (
            <input
              type="text"
              placeholder={e.kind === 'income' ? 'Remboursement caution, vente…' : 'Courses, resto, essence…'}
              value={e.title}
              aria-label="Titre"
              onInput={(ev) => {
                const title = ev.currentTarget.value;
                const patch: Partial<ExpenseData> = { title };
                if (!catTouched && e.kind === 'expense') {
                  const guess = guessCategory(title, catIds);
                  if (guess) patch.category = guess;
                }
                set(patch);
              }}
            />
          )}
          <AmountInput big value={e.amount} currency={e.currency} onValue={(amount) => set({ amount })} aria-label="Montant" />
          {showCurrency && (
            <div class="stack tight">
              <Field label="Devise">
                <CurrencySelect value={e.currency} onChange={(currency) => set({ currency })} />
              </Field>
              {e.currency !== base && (
                <div class="fx-line">
                  <span>1 {e.currency} =</span>
                  <NumberInput style={{ width: 120 }} value={e.rate} suffix={base} aria-label="Taux de change" onValue={(rate) => set({ rate })} />
                  <span class="grow">
                    {fx.loading ? 'taux en cours…' : fx.failed ? 'hors ligne : saisis le taux' : fx.at ? `taux ${fmtAgo(fx.at)}` : ''}
                  </span>
                  <strong class="num">≈ {fmt(converted, base)}</strong>
                </div>
              )}
            </div>
          )}
        </section>

        <section class="panel">
          {e.kind === 'transfer' ? (
            <>
              <Field label="De">
                <PersonChips people={people} value={e.payer} me={g.me} onChange={(payer: string) => set({ payer })} />
              </Field>
              <Field label="À">
                <PersonChips people={people.filter((p) => p.id !== e.payer)} value={e.to || ''} me={g.me} onChange={(to: string) => set({ to })} />
              </Field>
            </>
          ) : (
            <Field label={e.kind === 'income' ? 'Reçu par' : 'Payé par'}>
              <PersonChips people={people} value={e.payer} me={g.me} onChange={(payer: string) => set({ payer })} />
            </Field>
          )}
          <Field label="Date" for="ex-date">
            <input id="ex-date" type="date" value={e.date} onInput={(ev) => set({ date: ev.currentTarget.value || todayISO() })} />
          </Field>
        </section>

        {e.kind === 'expense' && (
          <section class="panel">
            <span class="label">Catégorie</span>
            <div class="chips">
              {d.categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  class={'chip' + (e.category === c.id ? ' on' : '')}
                  aria-pressed={e.category === c.id}
                  onClick={() => {
                    setCatTouched(true);
                    set({ category: e.category === c.id ? undefined : c.id });
                  }}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            {d.modules.fuel && <FuelCalc g={g} onUse={(amount) => set({ amount, category: catIds.includes('fuel') ? 'fuel' : e.category, title: e.title || 'Carburant' })} />}
          </section>
        )}

        {e.kind !== 'transfer' && (
          <section class="panel">
            <div class="panel-head">
              <h2>Pour qui</h2>
              <div class="row">
                <button type="button" class="btn ghost small" onClick={() => setAll(true)}>
                  Tous
                </button>
                <button type="button" class="btn ghost small" onClick={() => setAll(false)}>
                  Aucun
                </button>
              </div>
            </div>
            <Segmented<SplitMode>
              small
              value={e.split.mode}
              label="Mode de répartition"
              options={[
                { value: 'equal', label: 'Égal' },
                { value: 'shares', label: 'Parts' },
                { value: 'amounts', label: 'Montants' },
                { value: 'percent', label: '%' },
              ]}
              onChange={setMode}
            />
            <div>
              {splitPeople.map((p) => {
                const v = e.split.parts[p.id] ?? 0;
                const on = isOn(p.id);
                return (
                  <div class={'split-row' + (on ? '' : ' off')} key={p.id}>
                    <button type="button" class={'check' + (on ? ' on' : '')} aria-pressed={on} aria-label={'Inclure ' + p.name} onClick={() => toggle(p.id)}>
                      <Icon name="check" size={16} />
                    </button>
                    <button type="button" class="row gap" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', minWidth: 0 }} onClick={() => toggle(p.id)}>
                      <Avatar name={p.name} id={p.id} color={p.color} size={28} />
                      <span class="li-main">
                        <span class="li-title" style={{ display: 'block' }}>{p.name + (p.id === g.me ? ' (moi)' : '')}</span>
                        {on && e.split.mode !== 'equal' && e.split.mode !== 'amounts' && <span class="li-sub" style={{ display: 'block' }}>{fmt(shares[p.id] || 0, base)}</span>}
                      </span>
                    </button>
                    {e.split.mode === 'equal' && <span class="share-out">{on ? fmt(shares[p.id] || 0, base) : '—'}</span>}
                    {e.split.mode === 'shares' && (
                      <NumberInput value={on ? v : undefined} placeholder="0" suffix="parts" aria-label={'Parts de ' + p.name} onValue={(n) => set({ split: { ...e.split, parts: { ...e.split.parts, [p.id]: n } } })} />
                    )}
                    {e.split.mode === 'percent' && (
                      <NumberInput value={on ? v : undefined} placeholder="0" suffix="%" aria-label={'Pourcentage de ' + p.name} onValue={(n) => set({ split: { ...e.split, parts: { ...e.split.parts, [p.id]: n } } })} />
                    )}
                    {e.split.mode === 'amounts' && (
                      <AmountInput value={v} currency={e.currency} aria-label={'Montant de ' + p.name} onValue={(n) => set({ split: { ...e.split, parts: { ...e.split.parts, [p.id]: n } } })} />
                    )}
                  </div>
                );
              })}
            </div>
            {error && total > 0 && <p class="banner warn">{error}</p>}
          </section>
        )}

        <section class="panel">
          <span class="label">Photos du ticket</span>
          <Receipts projectId={g.p.id} ids={e.receipts || []} readOnly={readOnly} onChange={(receipts) => set({ receipts })} label="Ajouter" />
          <Field label="Note" for="ex-note">
            <textarea id="ex-note" value={e.note || ''} placeholder="Détails, numéro de commande…" onInput={(ev) => set({ note: ev.currentTarget.value })} />
          </Field>
        </section>
      </fieldset>

      {!readOnly && (
        <button type="button" class="btn primary block" onClick={save}>
          {id ? 'Enregistrer' : 'Ajouter'}
        </button>
      )}
      {id && !readOnly && (
        <button type="button" class="btn danger block" onClick={remove}>
          <Icon name="trash" size={18} /> Supprimer
        </button>
      )}
    </div>
  );
}

function FuelCalc({ g, onUse }: { g: Group; onUse: (cents: number) => void }) {
  const f = g.p.data.fuel || {};
  const [km, setKm] = useState(0);
  const [cons, setCons] = useState(f.consumption ?? 6.5);
  const [price, setPrice] = useState(f.price ?? 1.85);
  const amount = Math.round(((km * cons) / 100) * price * 100);
  return (
    <details>
      <summary>⛽ Calculer le carburant</summary>
      <div class="stack" style={{ marginTop: 12 }}>
        <div class="grid3">
          <Field label="Distance">
            <NumberInput value={km || undefined} placeholder="0" suffix="km" onValue={setKm} />
          </Field>
          <Field label="Conso">
            <NumberInput value={cons} suffix="L" onValue={setCons} />
          </Field>
          <Field label="Prix/L">
            <NumberInput value={price} suffix="€" onValue={setPrice} />
          </Field>
        </div>
        <div class="row between">
          <span class="muted small">Conso en L/100 km</span>
          <button
            type="button"
            class="btn soft small"
            disabled={!amount}
            onClick={() => {
              onUse(amount);
              updateProject<GroupData>(g.p.id, { fuel: { consumption: cons, price } });
            }}
          >
            Utiliser {fmt(amount, g.p.data.currency)}
          </button>
        </div>
      </div>
    </details>
  );
}
