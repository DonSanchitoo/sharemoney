import { useState } from 'preact/hooks';
import { InstallHint, SyncBadge } from '../../components/chrome';
import { InviteSheet } from '../../components/share';
import { toast } from '../../components/toast';
import { AmountInput, Avatar, Empty, Icon, NumberInput, Segmented } from '../../components/ui';
import { addMonths, monthKey, monthLabel } from '../../lib/date';
import { uuid } from '../../lib/ids';
import { fmt, fmtSigned } from '../../lib/money';
import { bestRentPayer, computeRent, sharesFromIncomes, transferKey } from '../../lib/rent';
import { go } from '../../lib/router';
import { meOf, putItem } from '../../lib/store';
import type { Item, Project, RentData, RentLine, RentMonthData } from '../../lib/types';
import { copyMonth, currentHousehold, equalShares, monthMembers, useHousehold } from './common';
import { RentSetup } from './RentSetup';

export function RentScreen(props: { view: 'month' | 'history' | 'setup'; month?: string }) {
  const p = currentHousehold();
  const [invite, setInvite] = useState(false);
  if (props.view === 'setup' || !p) return <RentSetup />;
  const hh = useHousehold(p);
  const key = props.month && /^\d{4}-\d{2}$/.test(props.month) ? props.month : monthKey();

  return (
    <div class="page">
      <div class="page-head">
        <div class="grow">
          <h1>
            {p.data.emoji} {p.data.name}
          </h1>
          <p class="sub">{hh.members.filter((m) => !m.data.archived).map((m) => m.data.name).join(' · ')}</p>
        </div>
        <div class="row">
          <button type="button" class="icon-btn" aria-label="Inviter" onClick={() => setInvite(true)}>
            <Icon name="userPlus" />
          </button>
          <button type="button" class="icon-btn" aria-label="Réglages du logement" onClick={() => go('rent/settings')}>
            <Icon name="sliders" />
          </button>
        </div>
      </div>
      <div class="row between">
        <SyncBadge />
      </div>
      <InstallHint />
      <Segmented
        value={props.view === 'history' ? 'history' : 'month'}
        options={[
          { value: 'month', label: 'Mois' },
          { value: 'history', label: 'Historique' },
        ]}
        onChange={(v) => go(v === 'history' ? 'rent/history' : 'rent/m/' + key, true)}
      />
      {props.view === 'history' ? <History p={p} hh={hh} /> : <MonthView p={p} hh={hh} monthKey={key} />}
      <InviteSheet open={invite} onClose={() => setInvite(false)} token={p.token} name={p.data.name} what="ton logement" />
    </div>
  );
}

type HH = ReturnType<typeof useHousehold>;

function MonthView({ p, hh, monthKey: key }: { p: Project<RentData>; hh: HH; monthKey: string }) {
  const item = hh.months.find((m) => m.data.month === key);
  const prev = hh.months.find((m) => m.data.month < key);
  const nav = (
    <div class="month-nav">
      <button type="button" class="icon-btn" aria-label="Mois précédent" onClick={() => go('rent/m/' + addMonths(key, -1), true)}>
        <Icon name="left" />
      </button>
      <h2>{monthLabel(key)}</h2>
      <button type="button" class="icon-btn" aria-label="Mois suivant" onClick={() => go('rent/m/' + addMonths(key, 1), true)}>
        <Icon name="right" />
      </button>
    </div>
  );
  if (!item) {
    return (
      <>
        {nav}
        <section class="panel">
          <Empty icon="🗓️" title={`Rien pour ${monthLabel(key).toLowerCase()}`}>
            {prev ? (
              <>
                <p>Reprends les lignes et les parts de {monthLabel(prev.data.month).toLowerCase()}, puis ajuste les montants.</p>
                <button type="button" class="btn primary" onClick={() => copyMonth(p.id, key, prev.data, hh.members)}>
                  Reprendre {monthLabel(prev.data.month, true)}
                </button>
              </>
            ) : null}
            <button type="button" class={'btn' + (prev ? ' ghost' : ' primary')} onClick={() => copyMonth(p.id, key, undefined, hh.members)}>
              Partir de zéro
            </button>
          </Empty>
        </section>
      </>
    );
  }
  return (
    <>
      {nav}
      <MonthEditor p={p} hh={hh} item={item} />
    </>
  );
}

function MonthEditor({ p, hh, item }: { p: Project<RentData>; hh: HH; item: Item<RentMonthData> }) {
  const m = item.data;
  const ids = monthMembers(m, hh.members);
  const r = computeRent(m, ids);
  const me = meOf(p.id);
  const name = (id: string) => hh.names[id] || '?';
  const save = (patch: Partial<RentMonthData>) => putItem<RentMonthData>(p.id, 'month', { ...m, ...patch }, item.id);
  const setLine = (id: string, patch: Partial<RentLine>) => save({ lines: m.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const addLine = (kind: RentLine['kind']) =>
    save({ lines: [...m.lines, { id: uuid(), label: '', amount: 0, kind, person: me && ids.includes(me) ? me : ids[0] }] });
  const done = m.done || {};
  const allDone = r.transfers.length > 0 && r.transfers.every((t) => done[transferKey(t)]);
  const toggleDone = (k: string) => save({ done: { ...done, [k]: !done[k] } });
  const alt = bestRentPayer(m, ids);
  const rentLines = m.lines.filter((l) => l.rent && l.amount > 0);
  const [incomes, setIncomes] = useState<Record<string, number> | null>(null);
  const shareSum = ids.reduce((s, id) => s + (m.shares?.[id] ?? 0), 0);
  const people = hh.members.filter((x) => ids.includes(x.id));

  return (
    <>
      <section class="panel accent" aria-live="polite">
        <div class="row between">
          <p class="eyebrow">Virements entre vous</p>
          {allDone && <span class="tag ok">Mois réglé ✓</span>}
        </div>
        {r.transfers.length === 0 ? (
          <div>
            <p class="big-amount">{fmt(0)}</p>
            <p>Vous êtes à égalité, aucun virement à faire.</p>
          </div>
        ) : r.transfers.length === 1 ? (
          <div class={'stack tight' + (done[transferKey(r.transfers[0])] ? ' muted' : '')}>
            <p class="big-amount">{fmt(r.transfers[0].amount)}</p>
            <p>
              <strong>{name(r.transfers[0].from)}</strong> verse à <strong>{name(r.transfers[0].to)}</strong>
            </p>
            <button type="button" class={'btn small ' + (done[transferKey(r.transfers[0])] ? 'soft' : '')} onClick={() => toggleDone(transferKey(r.transfers[0]))}>
              <span class={'check' + (done[transferKey(r.transfers[0])] ? ' on' : '')} style={{ width: 20, height: 20 }}>
                <Icon name="check" size={14} />
              </span>
              {done[transferKey(r.transfers[0])] ? 'Virement fait' : 'Marquer comme fait'}
            </button>
          </div>
        ) : (
          <div>
            {r.transfers.map((t) => {
              const k = transferKey(t);
              return (
                <div class={'transfer' + (done[k] ? ' done' : '')} key={k}>
                  <button type="button" class={'check' + (done[k] ? ' on' : '')} aria-label="Virement fait" aria-pressed={!!done[k]} onClick={() => toggleDone(k)}>
                    <Icon name="check" size={16} />
                  </button>
                  <span class="who">
                    <strong>{name(t.from)}</strong> → <strong>{name(t.to)}</strong>
                  </span>
                  <span class="amount">{fmt(t.amount)}</span>
                </div>
              );
            })}
          </div>
        )}
        <p class="hint num">
          {fmt(r.expenses)} de dépenses{r.aids ? ` − ${fmt(r.aids)} d’aides` : ''} = {fmt(r.net)} à partager
          {ids.length === 2 && Math.abs((m.shares?.[ids[0]] ?? 50) - (m.shares?.[ids[1]] ?? 50)) < 0.01
            ? `, soit ${fmt(r.share[ids[0]])} chacun.`
            : '.'}
        </p>
        {rentLines.length > 0 && (
          <ul class="list">
            {rentLines.map((l) => (
              <li class="balance-line" style={{ padding: '6px 0' }} key={l.id}>
                <span>
                  {name(l.person)} vire {!l.label || /^loyer$/i.test(l.label.trim()) ? 'le loyer' : `« ${l.label} »`} au propriétaire
                </span>
                <strong class="num">{fmt(l.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
        {alt && (
          <p class="hint">
            💡 Si {name(alt.person)} faisait le virement du loyer, il ne resterait que {fmt(alt.moved)} à échanger entre vous (au lieu de{' '}
            {fmt(alt.current)}).{' '}
            <button
              type="button"
              class="link-btn"
              style={{ padding: 0, fontSize: 'inherit' }}
              onClick={() => save({ lines: m.lines.map((l) => (l.rent ? { ...l, person: alt.person } : l)), done: {} })}
            >
              Appliquer
            </button>
          </p>
        )}
        <div class="scroll-x">
          <table>
            <thead>
              <tr>
                <th />
                {ids.map((id) => (
                  <th key={id}>{name(id) + (id === me ? ' (moi)' : '')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Payé</td>
                {ids.map((id) => (
                  <td key={id}>{fmt(r.paid[id])}</td>
                ))}
              </tr>
              {r.aids > 0 && (
                <tr>
                  <td>Aides reçues</td>
                  {ids.map((id) => (
                    <td key={id}>{fmt(r.got[id])}</td>
                  ))}
                </tr>
              )}
              <tr>
                <td>Part à sa charge</td>
                {ids.map((id) => (
                  <td key={id}>{fmt(r.share[id])}</td>
                ))}
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Solde</td>
                {ids.map((id) => (
                  <td key={id} class={r.balance[id] > 0.5 ? 'pos' : r.balance[id] < -0.5 ? 'neg' : ''}>
                    {fmtSigned(r.balance[id])}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="hint">Un solde positif veut dire que la personne a avancé plus que sa part et doit recevoir de l’argent.</p>
      </section>

      <section class="panel">
        <h2>Dépenses du mois</h2>
        <p class="hint">Loyer, charges, internet… et qui les paie.</p>
        <Lines kind="expense" lines={m.lines} ids={ids} names={hh.names} onChange={setLine} onRemove={(id) => save({ lines: m.lines.filter((l) => l.id !== id) })} />
        <button type="button" class="btn dashed small" onClick={() => addLine('expense')}>
          <Icon name="plus" size={16} /> Ajouter une dépense
        </button>
      </section>

      <section class="panel">
        <h2>Aides et rentrées</h2>
        <p class="hint">APL, aide employeur… versées à une personne et qui réduisent le coût pour tous.</p>
        <Lines kind="aid" lines={m.lines} ids={ids} names={hh.names} onChange={setLine} onRemove={(id) => save({ lines: m.lines.filter((l) => l.id !== id) })} />
        <button type="button" class="btn dashed small" onClick={() => addLine('aid')}>
          <Icon name="plus" size={16} /> Ajouter une aide
        </button>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Répartition</h2>
          <span class={'tag ' + (Math.abs(shareSum - 100) < 0.2 ? 'ok' : 'warn')}>{Math.round(shareSum * 10) / 10} %</span>
        </div>
        <p class="hint">Part de chacun dans le coût net (dépenses moins aides).</p>
        {people.map((x) => (
          <div class="row gap" key={x.id}>
            <Avatar name={x.data.name} id={x.id} color={x.data.color} size={30} />
            <span class="grow">{x.data.name}</span>
            <NumberInput
              style={{ width: 110 }}
              value={m.shares?.[x.id] ?? 0}
              suffix="%"
              aria-label={'Part de ' + x.data.name}
              onValue={(v) => save({ shares: { ...m.shares, [x.id]: v } })}
            />
          </div>
        ))}
        <div class="row gap wrap">
          <button type="button" class="btn small" onClick={() => save({ shares: equalShares(ids) })}>
            Parts égales
          </button>
          <button type="button" class="btn small" onClick={() => setIncomes(incomes ? null : {})}>
            Selon les revenus
          </button>
        </div>
        {incomes && (
          <div class="stack tight">
            <p class="hint">Revenus nets mensuels : les parts seront proportionnelles. Rien n’est enregistré.</p>
            {people.map((x) => (
              <div class="row gap" key={x.id}>
                <span class="grow">{x.data.name}</span>
                <AmountInput style={{ width: 140 }} value={incomes[x.id] || 0} onValue={(v) => setIncomes({ ...incomes, [x.id]: v })} />
              </div>
            ))}
            <button
              type="button"
              class="btn primary small"
              onClick={() => {
                const s = sharesFromIncomes(incomes);
                if (!Object.keys(s).length) return toast('Saisis au moins un revenu', { tone: 'warn' });
                save({ shares: s });
                setIncomes(null);
              }}
            >
              Appliquer
            </button>
          </div>
        )}
      </section>

      <section class="panel">
        <label class="label" for="rent-note">
          Note du mois
        </label>
        <textarea id="rent-note" placeholder="Régularisation de charges, mois partiel…" value={m.note || ''} onInput={(e) => save({ note: e.currentTarget.value })} />
      </section>
    </>
  );
}

function Lines(props: {
  kind: RentLine['kind'];
  lines: RentLine[];
  ids: string[];
  names: Record<string, string>;
  onChange: (id: string, patch: Partial<RentLine>) => void;
  onRemove: (id: string) => void;
}) {
  const list = props.lines.filter((l) => l.kind === props.kind);
  if (!list.length) return <p class="hint">{props.kind === 'aid' ? 'Aucune aide ce mois-ci.' : 'Aucune dépense.'}</p>;
  return (
    <div class="stack">
      {list.map((l) => {
        const all = !l.split || !l.split.length;
        return (
          <div class="line-row" key={l.id}>
            <input
              type="text"
              value={l.label}
              placeholder={props.kind === 'aid' ? 'APL, aide…' : 'Loyer, EDF, internet…'}
              aria-label="Libellé"
              onInput={(e) => props.onChange(l.id, { label: e.currentTarget.value })}
            />
            <AmountInput value={l.amount} onValue={(v) => props.onChange(l.id, { amount: v })} aria-label={'Montant ' + (l.label || '')} />
            <button type="button" class="btn icon-only" aria-label={'Supprimer ' + (l.label || 'la ligne')} onClick={() => props.onRemove(l.id)}>
              <Icon name="trash" size={18} />
            </button>
            <div class="line-meta">
              <select value={l.person} aria-label={props.kind === 'aid' ? 'Reçue par' : 'Payée par'} onChange={(e) => props.onChange(l.id, { person: e.currentTarget.value })}>
                {props.ids.map((id) => (
                  <option value={id} key={id}>
                    {(props.kind === 'aid' ? 'Reçue par ' : 'Payée par ') + props.names[id]}
                  </option>
                ))}
              </select>
              {props.kind === 'expense' && (
                <button type="button" class={'chip' + (l.rent ? ' soft-on' : '')} aria-pressed={!!l.rent} onClick={() => props.onChange(l.id, { rent: !l.rent })}>
                  🏠 Loyer
                </button>
              )}
            </div>
            {props.ids.length > 2 && (
              <div class="line-meta">
                <span class="small muted">Pour :</span>
                <button type="button" class={'chip' + (all ? ' on' : '')} onClick={() => props.onChange(l.id, { split: null })}>
                  Tous
                </button>
                {props.ids.map((id) => {
                  const on = !all && l.split!.includes(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      class={'chip' + (on ? ' on' : '')}
                      onClick={() => {
                        const cur = all ? [] : l.split!;
                        const next = on ? cur.filter((x) => x !== id) : [...cur, id];
                        props.onChange(l.id, { split: next.length && next.length < props.ids.length ? next : null });
                      }}
                    >
                      {props.names[id]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function History({ p, hh }: { p: Project<RentData>; hh: HH }) {
  const me = meOf(p.id);
  const rows = hh.months.map((it) => {
    const ids = monthMembers(it.data, hh.members);
    const r = computeRent(it.data, ids);
    const done = it.data.done || {};
    const pending = r.transfers.filter((t) => !done[transferKey(t)]).length;
    return { it, r, pending, mine: me ? r.share[me] : undefined };
  });
  if (!rows.length) return <Empty icon="📭" title="Pas encore d’historique" />;
  const last12 = rows.slice(0, 12).reverse();
  const max = Math.max(...last12.map((x) => x.r.net), 1);
  const year = new Date().getFullYear().toString();
  const ytd = rows.filter((x) => x.it.data.month.startsWith(year));
  const sum = (f: (x: (typeof rows)[0]) => number) => ytd.reduce((s, x) => s + f(x), 0);

  return (
    <>
      <section class="panel">
        <h2>Reste à charge par mois</h2>
        <div class="vbars" role="img" aria-label="Reste à charge des 12 derniers mois">
          {last12.map((x) => (
            <button type="button" class="vbar" style={{ background: 'none', border: 0, padding: 0 }} key={x.it.id} onClick={() => go('rent/m/' + x.it.data.month)} title={fmt(x.r.net)}>
              <span style={{ height: Math.max(2, (x.r.net / max) * 100) + '%' }} />
              <small>{monthLabel(x.it.data.month, true)}</small>
            </button>
          ))}
        </div>
      </section>
      {ytd.length > 0 && (
        <div class="stat-grid">
          <div class="stat">
            <span class="v">{fmt(sum((x) => x.r.expenses))}</span>
            <span class="k">Dépenses {year}</span>
          </div>
          <div class="stat">
            <span class="v">{fmt(sum((x) => x.r.aids))}</span>
            <span class="k">Aides {year}</span>
          </div>
          <div class="stat">
            <span class="v">{fmt(sum((x) => x.r.net))}</span>
            <span class="k">Reste à charge {year}</span>
          </div>
          {me && (
            <div class="stat">
              <span class="v">{fmt(sum((x) => x.mine || 0))}</span>
              <span class="k">Ta part {year}</span>
            </div>
          )}
        </div>
      )}
      <section class="panel flush">
        <ul class="list">
          {rows.map((x) => (
            <li key={x.it.id}>
              <button type="button" class="li" onClick={() => go('rent/m/' + x.it.data.month)}>
                <div class="li-main">
                  <div class="li-title">{monthLabel(x.it.data.month)}</div>
                  <div class="li-sub">
                    Reste à charge {fmt(x.r.net)}
                    {x.mine != null ? ` · ta part ${fmt(x.mine)}` : ''}
                  </div>
                </div>
                <div class="li-end">
                  {x.r.transfers.length === 0 ? (
                    <span class="tag ok">Équilibré</span>
                  ) : x.pending === 0 ? (
                    <span class="tag ok">Réglé ✓</span>
                  ) : (
                    <span class="tag warn">{x.pending} virement{x.pending > 1 ? 's' : ''}</span>
                  )}
                </div>
                <Icon name="right" size={18} class="muted" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
