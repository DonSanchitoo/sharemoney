import { useState } from 'preact/hooks';
import { Empty, Icon } from '../../components/ui';
import { baseAmount, splitShares } from '../../lib/calc';
import { fmtDayTitle } from '../../lib/date';
import { fmt } from '../../lib/money';
import { go } from '../../lib/router';
import type { ExpenseData, Item } from '../../lib/types';
import { categoryOf, expenseLabel, type Group } from './common';

function myImpact(e: ExpenseData, me: string | undefined): number | null {
  if (!me) return null;
  const v = baseAmount(e);
  if (e.kind === 'transfer') return e.payer === me ? v : e.to === me ? -v : null;
  const share = splitShares(v, e.split)[me] || 0;
  if (e.kind === 'income') return (share || 0) - (e.payer === me ? v : 0);
  const paid = e.payer === me ? v : 0;
  if (!paid && !share) return null;
  return paid - share;
}

export function ExpenseRow({ g, it }: { g: Group; it: Item<ExpenseData> }) {
  const e = it.data;
  const cur = g.p.data.currency;
  const cat = categoryOf(g.p, e.category);
  const impact = myImpact(e, g.me);
  const icon = e.kind === 'transfer' ? '💸' : e.kind === 'income' ? '💰' : cat.icon;
  return (
    <button type="button" class="li" onClick={() => go(`p/${g.p.id}/e/${it.id}`)}>
      <span class="cat-icon">{icon}</span>
      <div class="li-main">
        <div class="li-title">{e.title || (e.kind === 'transfer' ? 'Remboursement' : 'Sans titre')}</div>
        <div class="li-sub">
          {expenseLabel(e, g.names, g.me)}
          {e.receipts?.length ? ' · 📎' : ''}
        </div>
      </div>
      <div class="li-end">
        <div class="strong">{fmt(e.amount, e.currency)}</div>
        {e.currency !== cur ? (
          <div class="li-sub">≈ {fmt(baseAmount(e), cur)}</div>
        ) : impact != null && Math.abs(impact) >= 1 && e.kind !== 'transfer' ? (
          <div class={'li-sub ' + (impact > 0 ? 'pos' : 'neg')}>{impact > 0 ? `tu prêtes ${fmt(impact, cur)}` : `tu dois ${fmt(-impact, cur)}`}</div>
        ) : null}
      </div>
    </button>
  );
}

export function ExpensesTab({ g }: { g: Group }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  if (!g.expenses.length) {
    return (
      <section class="panel">
        <Empty icon="🧾" title="Aucune dépense">
          <p>Ajoute la première avec le bouton +. Tu peux joindre une photo du ticket.</p>
          {!g.readOnly && (
            <button type="button" class="btn primary" onClick={() => go(`p/${g.p.id}/e/new`)}>
              Ajouter une dépense
            </button>
          )}
        </Empty>
      </section>
    );
  }

  const needle = q.trim().toLowerCase();
  const list = g.expenses.filter((it) => {
    const e = it.data;
    if (cat && e.category !== cat) return false;
    if (who && e.payer !== who && e.to !== who && !(e.split?.parts?.[who] > 0)) return false;
    if (needle && !`${e.title} ${e.note || ''} ${g.names[e.payer] || ''}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const days: { day: string; items: Item<ExpenseData>[]; total: number }[] = [];
  for (const it of list) {
    const last = days[days.length - 1];
    const v = it.data.kind === 'expense' ? baseAmount(it.data) : 0;
    if (last && last.day === it.data.date) {
      last.items.push(it);
      last.total += v;
    } else days.push({ day: it.data.date, items: [it], total: v });
  }
  const usedCats = Array.from(new Set(g.expenses.map((e) => e.data.category).filter(Boolean))) as string[];
  const filtered = list.length !== g.expenses.length;
  const filteredTotal = list.reduce((s, it) => s + (it.data.kind === 'expense' ? baseAmount(it.data) : 0), 0);

  return (
    <>
      <div class="row gap">
        <input type="search" placeholder="Rechercher" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Rechercher une dépense" />
        <button type="button" class={'btn icon-only' + (cat || who ? ' soft' : '')} aria-label="Filtres" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
          <Icon name="sliders" size={18} />
        </button>
      </div>
      {showFilters && (
        <div class="stack tight">
          <div class="chips scroll">
            <button type="button" class={'chip' + (!cat ? ' on' : '')} onClick={() => setCat(null)}>
              Toutes catégories
            </button>
            {usedCats.map((c) => {
              const k = categoryOf(g.p, c);
              return (
                <button type="button" key={c} class={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(cat === c ? null : c)}>
                  {k.icon} {k.label}
                </button>
              );
            })}
          </div>
          <div class="chips scroll">
            <button type="button" class={'chip' + (!who ? ' on' : '')} onClick={() => setWho(null)}>
              Tout le monde
            </button>
            {g.allPeople.map((p) => (
              <button type="button" key={p.id} class={'chip' + (who === p.id ? ' on' : '')} onClick={() => setWho(who === p.id ? null : p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {filtered && (
        <p class="small muted">
          {list.length} résultat{list.length > 1 ? 's' : ''} · {fmt(filteredTotal, g.p.data.currency)} de dépenses
        </p>
      )}
      <section class="panel flush">
        {days.map((d) => (
          <div key={d.day}>
            <div class="day-head row between">
              <span>{fmtDayTitle(d.day)}</span>
              {d.total > 0 && <span class="num">{fmt(d.total, g.p.data.currency)}</span>}
            </div>
            <div class="list">
              {d.items.map((it) => (
                <div class="li-wrap" key={it.id}>
                  <ExpenseRow g={g} it={it} />
                </div>
              ))}
            </div>
          </div>
        ))}
        {!list.length && <p class="muted center-text" style={{ padding: 16 }}>Aucun résultat.</p>}
      </section>
    </>
  );
}
