import { useState } from 'preact/hooks';
import { toast } from '../../components/toast';
import { AmountInput, Avatar, Field, Gauge, PersonChips, Sheet } from '../../components/ui';
import { baseAmount } from '../../lib/calc';
import { todayISO } from '../../lib/date';
import { fmt } from '../../lib/money';
import { putItem, updateProject } from '../../lib/store';
import type { ExpenseData, GroupData } from '../../lib/types';
import { memberName, type Group } from './common';

/**
 * Cagnotte : un objectif et un porteur. Chaque contribution est un virement
 * vers le porteur (pris en compte dans l'équilibre) ; les achats faits avec
 * la cagnotte sont des dépenses normales payées par le porteur.
 */
export function PotTab({ g }: { g: Group }) {
  const d = g.p.data;
  const cur = d.currency;
  const pot = d.pot || {};
  const holder = pot.holder && g.names[pot.holder] ? pot.holder : undefined;
  const [contrib, setContrib] = useState<{ from: string; amount: number } | null>(null);
  const contributions = g.expenses.filter((e) => e.data.kind === 'transfer' && e.data.pot && e.data.to === holder);
  const byPerson: Record<string, number> = {};
  for (const c of contributions) byPerson[c.data.payer] = (byPerson[c.data.payer] || 0) + baseAmount(c.data);
  // Le porteur compte aussi ce qu'il a mis de sa poche dans les achats.
  const collected = contributions.reduce((s, c) => s + baseAmount(c.data), 0);
  const contributors = g.members.filter((m) => !m.data.archived && !m.data.honoree && m.id !== holder);
  const target = pot.target || 0;
  const fair = target && contributors.length + (holder ? 1 : 0) ? Math.round(target / (contributors.length + (holder ? 1 : 0))) : 0;
  const ro = g.readOnly;

  const setPot = (patch: Partial<NonNullable<GroupData['pot']>>) => updateProject<GroupData>(g.p.id, { pot: { ...pot, ...patch } });

  function saveContribution() {
    if (!contrib || !contrib.amount || !holder) return;
    putItem<ExpenseData>(g.p.id, 'expense', {
      kind: 'transfer',
      title: 'Participation cagnotte',
      amount: contrib.amount,
      currency: cur,
      rate: 1,
      payer: contrib.from,
      to: holder,
      date: todayISO(),
      split: { mode: 'equal', parts: {} },
      pot: true,
      createdBy: g.me,
    });
    toast('Participation enregistrée');
    setContrib(null);
  }

  return (
    <>
      <section class="panel accent">
        <p class="eyebrow">{pot.label || 'Cagnotte'}</p>
        <p class="big-amount">{fmt(collected, cur)}</p>
        {target > 0 ? (
          <>
            <Gauge value={collected} max={target} tone={collected >= target ? 'ok' : 'ok'} />
            <p class="hint num">
              {Math.round((collected / target) * 100)} % de {fmt(target, cur)}
              {collected < target ? ` · il manque ${fmt(target - collected, cur)}` : ' · objectif atteint 🎉'}
            </p>
          </>
        ) : (
          <p class="hint">Fixe un objectif ci-dessous pour suivre la progression.</p>
        )}
        {holder && <p class="hint">Porteur : {memberName(g.names, holder, g.me)}. Les achats faits avec la cagnotte sont à saisir en dépenses payées par cette personne.</p>}
        {!ro && holder && (
          <button type="button" class="btn primary" onClick={() => setContrib({ from: g.me && g.me !== holder ? g.me : contributors[0]?.id || '', amount: fair })}>
            Ajouter une participation
          </button>
        )}
      </section>

      <section class="panel">
        <h2>Réglages</h2>
        <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0, display: 'contents' }}>
          <Field label="Nom de la cagnotte">
            <input type="text" placeholder="Cadeau pour Julie" value={pot.label || ''} onInput={(e) => setPot({ label: e.currentTarget.value })} />
          </Field>
          <Field label="Objectif">
            <AmountInput value={target} currency={cur} onValue={(v) => setPot({ target: v })} />
          </Field>
          <Field label="Qui collecte l’argent">
            <PersonChips people={g.people} value={holder || ''} me={g.me} onChange={(id: string) => setPot({ holder: id })} />
          </Field>
        </fieldset>
      </section>

      {holder && (
        <section class="panel">
          <div class="panel-head">
            <h2>Participations</h2>
            {fair > 0 && <span class="small muted">≈ {fmt(fair, cur)} / pers.</span>}
          </div>
          {contributors.map((m) => {
            const v = byPerson[m.id] || 0;
            return (
              <div class="row gap" key={m.id}>
                <Avatar name={m.data.name} id={m.id} color={m.data.color} size={30} />
                <span class="grow">{memberName(g.names, m.id, g.me)}</span>
                <strong class="num">{fmt(v, cur)}</strong>
                {fair > 0 && (v >= fair ? <span class="tag ok">✓</span> : <span class="tag warn">−{fmt(fair - v, cur)}</span>)}
              </div>
            );
          })}
          {g.members.some((m) => m.data.honoree) && (
            <p class="hint">Personne(s) fêtée(s), exclue(s) : {g.members.filter((m) => m.data.honoree).map((m) => m.data.name).join(', ')}.</p>
          )}
        </section>
      )}

      {contrib && (
        <Sheet open title="Participation" onClose={() => setContrib(null)} onSave={saveContribution} saveLabel="Enregistrer">
          <Field label="Qui participe">
            <PersonChips people={g.people.filter((p) => p.id !== holder)} value={contrib.from} me={g.me} onChange={(from: string) => setContrib({ ...contrib, from })} />
          </Field>
          <Field label="Montant">
            <AmountInput big value={contrib.amount} currency={cur} onValue={(amount) => setContrib({ ...contrib, amount })} />
          </Field>
          <p class="hint">Enregistré comme un versement à {memberName(g.names, holder, g.me)}.</p>
        </Sheet>
      )}
    </>
  );
}
